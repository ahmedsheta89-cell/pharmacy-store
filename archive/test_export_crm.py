import io,json,tempfile,unittest,pathlib,urllib.request
from unittest.mock import patch
from export_crm import archive,APPROVED_ENDPOINT,NoRedirect,verify_restore,MAX_RESPONSE_BYTES
class Response(io.BytesIO):
 status=200
 def geturl(self):return APPROVED_ENDPOINT
class Opener:
 def __init__(self,fn):self.fn=fn
 def open(self,req,timeout):return Response(json.dumps(self.fn(json.loads(req.data))).encode())
def pages(b):
 if b['mode']=='index':return {'ok':True,'conversations':[{'id':'conv-demo'}],'has_more':False}
 start=b['after'];end=min(start+50,125)
 return {'ok':True,'messages':[{'id':str(i),'seq':i}for i in range(start+1,end+1)],'next_cursor':end,'has_more':end<125}
class ArchiveTests(unittest.TestCase):
 def test_all_pages_and_restore_integrity(self):
  with tempfile.TemporaryDirectory()as d,patch('urllib.request.build_opener',return_value=Opener(pages)):
   result=archive(APPROVED_ENDPOINT,d,'test-key');self.assertEqual(verify_restore(result)['rows'],126)
   text=result.read_text();result.write_text(text.replace('conv-demo','conv-tampered'))
   with self.assertRaises(ValueError):verify_restore(result)
 def test_failure_keeps_previous_backup(self):
  with tempfile.TemporaryDirectory()as d:
   old=pathlib.Path(d)/'old.ndjson';old.write_text('previous')
   with patch('urllib.request.build_opener',side_effect=OSError('offline')):
    with self.assertRaises(OSError):archive(APPROVED_ENDPOINT,d,'test-key')
   self.assertEqual(old.read_text(),'previous');self.assertEqual(list(pathlib.Path(d).glob('*.pending')),[])
 def test_destination_binding_before_any_authorized_request(self):
  for url in ['http://oneforallgood-assistant.oneforallgood-store.workers.dev/crm/archive',APPROVED_ENDPOINT+'?x=1',APPROVED_ENDPOINT+'#x',APPROVED_ENDPOINT+'/',APPROVED_ENDPOINT.replace('https://','https://user:pass@'),'https://attacker.invalid/crm/archive',APPROVED_ENDPOINT.replace('.dev/','.dev:443/')]:
   with patch('urllib.request.build_opener')as opener,tempfile.TemporaryDirectory()as d:
    with self.assertRaises(ValueError):archive(url,d,'NEVER_SEND')
    opener.assert_not_called()
 def test_redirects_never_followed(self):
  handler=NoRedirect();request=urllib.request.Request(APPROVED_ENDPOINT,headers={'Authorization':'Bearer test'})
  for code in [301,302,303,307,308]:
   with self.assertRaises(ValueError):handler.redirect_request(request,None,code,'',{},'https://attacker.invalid/')
 def test_oversize_response(self):
  class Large:
   def open(self,*a,**k):return Response(b'x'*(MAX_RESPONSE_BYTES+1))
  with tempfile.TemporaryDirectory()as d,patch('urllib.request.build_opener',return_value=Large()):
   with self.assertRaises(ValueError):archive(APPROVED_ENDPOINT,d,'key')
   self.assertFalse((pathlib.Path(d)/'last-success.json').exists())
 def test_page_bound_and_atomic_success_manifest(self):
  with tempfile.TemporaryDirectory()as d,patch('urllib.request.build_opener',return_value=Opener(pages)),patch('export_crm.MAX_PAGES',1):
   with self.assertRaises(ValueError):archive(APPROVED_ENDPOINT,d,'key')
   self.assertFalse((pathlib.Path(d)/'last-success.json').exists());self.assertEqual(list(pathlib.Path(d).glob('*.pending')),[])

class PersistenceTests(unittest.TestCase):
 def test_retention_and_atomic_last_success(self):
  import os
  original=os.replace;replacements=[]
  def replace(src,dst):replacements.append(pathlib.Path(dst).name);return original(src,dst)
  with tempfile.TemporaryDirectory()as d,patch('urllib.request.build_opener',return_value=Opener(pages)),patch('export_crm.os.replace',side_effect=replace):
   for i in range(9):archive(APPROVED_ENDPOINT,d,'key')
   self.assertEqual(len(list(pathlib.Path(d).glob('crm-*.ndjson'))),7)
   self.assertEqual(replacements.count('last-success.json'),9)
   result=json.loads((pathlib.Path(d)/'last-success.json').read_text());verify_restore(pathlib.Path(d)/result['file'])
 def test_total_time_bound(self):
  with tempfile.TemporaryDirectory()as d,patch('export_crm.MAX_SECONDS',-1),patch('urllib.request.build_opener',return_value=Opener(pages)):
   with self.assertRaises(ValueError):archive(APPROVED_ENDPOINT,d,'key')
   self.assertFalse((pathlib.Path(d)/'last-success.json').exists())

if __name__=='__main__':unittest.main()
