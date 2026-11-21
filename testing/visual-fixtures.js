// Test-only synthetic session state. Never imported by production config.
const id='conv-12345678901234567890',now=new Date().toISOString();
let user={id:'owner',uid:'owner',name:'مشرف تجريبي',email:'ahmedsheta89@gmail.com',emailVerified:true,role:'owner',active:true};
const listeners=new Set(),previous=[],errors=[],roleListeners=new Set();
const c={id,channel:'store',status:'open',customer_key:'fixture',customer_name:'عميل تجريبي',assignee_uid:'owner',tags:[],order_ids:['order-demo'],preview:'محتاج أعرف ميعاد تجهيز الطلب',last_message_at:now,awaiting:'staff'};
const callback=(value,cb)=>{queueMicrotask(()=>cb(value));previous.push(()=>cb(value));return ()=>{};};
export const watchAuth=cb=>{listeners.add(cb);cb(user);return ()=>listeners.delete(cb);};
export const watchStaffRole=(uid,cb,onError)=>{roleListeners.add(cb);if(onError)errors.push(onError);const stop=callback(uid===user.uid?{...user}:null,cb);return ()=>{roleListeners.delete(cb);stop();};};
export const watchStaff=cb=>callback([{...user}],cb),watchInbox=(f,cb,onError)=>{if(onError)errors.push(onError);return callback(user.uid==='owner'?[c]:[],cb);},watchConversation=(id,cb,onError)=>{if(onError)errors.push(onError);return callback(user.uid==='owner'?c:null,cb);};
export const watchMessages=(id,cb,onError)=>{if(onError)errors.push(onError);return callback(user.uid==='owner'?[{id:'m1',sender:'customer',kind:'text',body:'محتاج أعرف ميعاد تجهيز الطلب',created_at:now},{id:'m2',sender:'agent',kind:'note',body:'ملاحظة داخلية تجريبية للفريق فقط',created_at:now},{id:'m3',sender:'system',kind:'order_event',body:'طلبك اتسجل، كود تجريبي فقط',created_at:now}]:[],cb);};
export const watchPresence=(id,cb)=>callback([],cb),loadCustomer=async()=>({name:'عميل تجريبي',phone:null}),recordView=async()=>{};
export const staffSignIn=async()=>{},staffSignOut=async()=>{},sendReply=async()=>{},addNote=async()=>{},assignConversation=async()=>{},setConversationStatus=async()=>{},heartbeat=async()=>{},clearPresence=async()=>{},sendOrderReady=async()=>{},suggestReply=async()=> 'مسودة تجريبية للمراجعة';
globalThis.__crmFixtures={switchUser(){user={uid:'agent-b',id:'agent-b',name:'موظف ب',email:'b@example.test',emailVerified:true,role:'agent',active:true};for(const cb of listeners)cb({...user});},denyAssignment(){for(const error of errors)error({code:'permission-denied'});},revokeRole(){user={...user,active:false};for(const cb of roleListeners)cb({...user});},replayStale(){for(const cb of previous.slice(0,6))cb();}};
