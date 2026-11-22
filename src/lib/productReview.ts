export type ReviewFields = {content_review_status?: string; content_source?: unknown; content_reviewer?: unknown; content_reviewed_at?: unknown; content_version?: unknown};
export type ReviewIssue = {field: 'content_source'|'content_reviewer'|'content_reviewed_at'|'content_version'; message: string};
export function reviewToday(now = new Date()): string {
 const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-');
}
function text(value:unknown):string{return typeof value==='string'?value.trim():'';}
export function reviewIssues(p:ReviewFields,today=reviewToday()):ReviewIssue[]{
 if(p.content_review_status!=='reviewed')return [];
 const issues:ReviewIssue[]=[];
 if(!text(p.content_source))issues.push({field:'content_source',message:'اكتب المصدر أو مرجع النشرة الذي راجعته.'});
 if(!text(p.content_reviewer))issues.push({field:'content_reviewer',message:'اكتب اسم من راجع البيانات فعليًا.'});
 const date=text(p.content_reviewed_at);
 const parsed=/^\d{4}-\d{2}-\d{2}$/.test(date)?Date.parse(date+'T00:00:00Z'):NaN;
 if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==date)issues.push({field:'content_reviewed_at',message:'اكتب تاريخًا صحيحًا لإتمام المراجعة.'});
 else if(date>today)issues.push({field:'content_reviewed_at',message:'تاريخ المراجعة لا يمكن أن يكون في المستقبل. اكتب تاريخ المراجعة الفعلية.'});
 if(!text(p.content_version))issues.push({field:'content_version',message:'اكتب رقم أو اسم نسخة البيانات التي راجعتها.'});
 return issues;
}
