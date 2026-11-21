"""Bounded local CRM archive. Destination is fixed, redirects are refused.
No key may be installed until Windows owner-only ACL, disk encryption, retention
and a restore drill pass. This script does not configure those OS controls.
"""
import argparse, datetime, hashlib, json, os, pathlib, tempfile, time, urllib.request, urllib.error, urllib.parse
APPROVED_ENDPOINT='https://oneforallgood-assistant.oneforallgood-store.workers.dev/crm/archive'
MAX_SECONDS=300
MAX_PAGES=500
MAX_RESPONSE_BYTES=1024*1024
MAX_ARCHIVE_BYTES=50*1024*1024
RETAIN_ARCHIVES=7
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('archive_redirect_refused')
def validate_endpoint(endpoint):
    parts=urllib.parse.urlsplit(endpoint)
    if endpoint!=APPROVED_ENDPOINT or parts.scheme!='https' or parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError('unapproved_archive_destination')
    return endpoint
def _atomic_json(path,value):
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=path.parent,delete=False,suffix='.pending')as out:
            temporary=out.name;json.dump(value,out);out.flush();os.fsync(out.fileno())
        os.replace(temporary,path)
    finally:
        if temporary and os.path.exists(temporary):os.unlink(temporary)
def verify_restore(path):
    """Integrity/schema drill. A real POS restore drill is still a rollout gate."""
    digest=hashlib.sha256();count=0;manifest=None
    with open(path,'rb')as source:
        for raw in source:
            if len(raw)>MAX_RESPONSE_BYTES:raise ValueError('oversize_archive_line')
            row=json.loads(raw)
            if row.get('type')=='manifest':
                if manifest is not None:raise ValueError('duplicate_manifest')
                manifest=row
                if row.get('sha256')!=digest.hexdigest() or row.get('rows')!=count:raise ValueError('archive_integrity_failure')
            else:
                if manifest is not None or row.get('type')not in('conversation','message'):raise ValueError('invalid_archive')
                digest.update(raw);count+=1
    if manifest is None:raise ValueError('incomplete_archive')
    return manifest

def archive(endpoint, folder, secret):
    endpoint=validate_endpoint(endpoint) # before constructing any authorized request
    root=pathlib.Path(folder);root.mkdir(parents=True,exist_ok=True)
    opener=urllib.request.build_opener(NoRedirect())
    deadline=time.monotonic()+MAX_SECONDS;pages=0
    def call(body):
        nonlocal pages
        pages+=1
        if pages>MAX_PAGES or time.monotonic()>=deadline:raise ValueError('archive_budget_exhausted')
        request=urllib.request.Request(endpoint,data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+secret,'Content-Type':'application/json'},method='POST')
        # No redirect or HTTP-error retries carrying credentials to new targets.
        with opener.open(request,timeout=min(15,max(1,deadline-time.monotonic())))as r:
            if r.geturl()!=endpoint or getattr(r,'status',200)!=200:raise ValueError('unexpected_response')
            raw=r.read(MAX_RESPONSE_BYTES+1)
            if time.monotonic()>=deadline:raise ValueError('archive_deadline_exceeded')
            if len(raw)>MAX_RESPONSE_BYTES:raise ValueError('response_too_large')
            value=json.loads(raw)
            if not isinstance(value,dict)or value.get('ok')is not True or type(value.get('has_more'))is not bool:raise ValueError('invalid_response')
            return value
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    dest=root/('crm-'+stamp+'.ndjson');temporary=None;total=0;rows=0;digest=hashlib.sha256()
    try:
        with tempfile.NamedTemporaryFile(mode='wb',dir=root,delete=False,suffix='.pending')as out:
            temporary=out.name;cursor='';count=0
            def emit(value):
                nonlocal total,rows
                raw=(json.dumps(value,ensure_ascii=False)+'\n').encode();total+=len(raw);rows+=1
                if total>MAX_ARCHIVE_BYTES or time.monotonic()>=deadline:raise ValueError('archive_budget_exhausted')
                out.write(raw);digest.update(raw)
            while True:
                page=call({'mode':'index','after':cursor});conversations=page.get('conversations')
                if not isinstance(conversations,list)or len(conversations)>20:raise ValueError('invalid_conversation_page')
                for c in conversations:
                    if not isinstance(c,dict)or not isinstance(c.get('id'),str):raise ValueError('invalid_conversation')
                    emit({'type':'conversation','data':c});seq=0
                    while True:
                        response=call({'mode':'messages','conversation_id':c['id'],'after':seq});messages=response.get('messages')
                        if not isinstance(messages,list)or len(messages)>50:raise ValueError('invalid_message_page')
                        for m in messages:
                            if not isinstance(m,dict)or type(m.get('seq'))is not int or m['seq']<=seq:raise ValueError('invalid_sequence')
                            seq=m['seq'];emit({'type':'message','conversation_id':c['id'],'data':m})
                        if not response['has_more']:break
                        if not messages or response.get('next_cursor')!=seq:raise ValueError('nonadvancing_message_cursor')
                    count+=1
                if not page['has_more']:break
                next_cursor=page.get('next_cursor')
                if not isinstance(next_cursor,str)or next_cursor<=cursor:raise ValueError('nonadvancing_index_cursor')
                cursor=next_cursor
            out.write((json.dumps({'type':'manifest','completed_at':stamp,'conversations':count,'rows':rows,'sha256':digest.hexdigest()})+'\n').encode())
            out.flush();os.fsync(out.fileno())
        verify_restore(temporary)
        os.replace(temporary,dest)
        _atomic_json(root/'last-success.json',{'file':dest.name,'completed_at':stamp,'conversations':count})
        # Retain at least seven completed, integrity-checked archives, never .pending.
        good=[]
        for candidate in sorted(root.glob('crm-*.ndjson'),reverse=True):
            try:verify_restore(candidate);good.append(candidate)
            except (ValueError,OSError):continue
        for old in good[RETAIN_ARCHIVES:]:old.unlink()
        return dest
    finally:
        if temporary and os.path.exists(temporary):os.unlink(temporary)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--folder',required=True);args=p.parse_args()
    key=os.environ.get('CRM_ARCHIVE_SECRET')
    if not key:raise SystemExit('Archive key unavailable. No archive made.')
    try:
        result=archive(APPROVED_ENDPOINT,args.folder,key);print('Archive saved:',result.name)
    except Exception:raise SystemExit('Archive failed. Check last-success. Prior successful archives remain.')
