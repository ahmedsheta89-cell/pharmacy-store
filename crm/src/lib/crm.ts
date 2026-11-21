import {pinnedOwner} from '../../../packages/crm-schema/session.js';
import {pendingId,clearPending,fingerprint} from '../../../packages/crm-schema/retry.js';
import {initializeApp,getApps} from 'firebase/app';
import {getFirestore,collection,doc,query,where,orderBy,limit,onSnapshot,setDoc,deleteDoc,serverTimestamp,type FirestoreError,type Unsubscribe} from 'firebase/firestore';
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged,type User} from 'firebase/auth';
import type {Conversation,ConversationMessage,Customer,StaffMember,SavedReply,Presence} from '../../../packages/crm-schema';
const app=getApps()[0]||initializeApp({apiKey:'AIzaSyCsRvLEcaGr1DV6a6HFHmR4Xe9mzqgpApQ',authDomain:'one-for-all-good.firebaseapp.com',projectId:'one-for-all-good',appId:'1:286528426482:web:d3fe576f3043fe2c0a5b6b'});
export const db=getFirestore(app),auth=getAuth(app);
type ListenerError=(error:FirestoreError)=>void;
const WORKER='https://oneforallgood-assistant.oneforallgood-store.workers.dev';
export const watchAuth=(cb:(u:User|null)=>void)=>onAuthStateChanged(auth,cb);
export const staffSignIn=(email:string,password:string)=>signInWithEmailAndPassword(auth,email,password);
export const staffSignOut=()=>signOut(auth);
export const watchStaffRole=(uid:string,cb:(s:(StaffMember&{id:string})|null)=>void,onError?:ListenerError)=>onSnapshot(doc(db,'staff',uid),d=>cb(d.exists()?{id:d.id,...d.data()} as StaffMember&{id:string}:null),error=>{cb(null);onError?.(error);});
export function watchStaff(cb:(s:(StaffMember&{id:string})[])=>void,onError?:ListenerError):Unsubscribe {
  const u=auth.currentUser;if(!u)return ()=>{};
  const owner=pinnedOwner(u,import.meta.env.VITE_CRM_OWNER_UID);
  if(!owner)return watchStaffRole(u.uid,s=>cb(s?[s]:[]),onError);
  return onSnapshot(query(collection(db,'staff'),where('active','==',true)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()} as StaffMember&{id:string}))),error=>{cb([]);onError?.(error);});
}
export type InboxFilter={status?:Conversation['status'];assignee?:string|'none';channel?:Conversation['channel']};
export function watchInbox(filter:InboxFilter,cb:(c:(Conversation&{id:string})[])=>void,onError?:ListenerError):Unsubscribe {
  const u=auth.currentUser;if(!u)return ()=>{};
  const owner=pinnedOwner(u,import.meta.env.VITE_CRM_OWNER_UID);
  const clauses=[...(filter.status?[where('status','==',filter.status)]:[]),
    ...(!owner?[where('assignee_uid','==',u.uid)]:filter.assignee?[where('assignee_uid','==',filter.assignee==='none'?null:filter.assignee)]:[])];
  return onSnapshot(query(collection(db,'conversations'),...clauses,orderBy('last_message_at','desc'),limit(200)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()} as Conversation&{id:string}))),error=>{cb([]);onError?.(error);});
}
export const watchConversation=(id:string,cb:(c:(Conversation&{id:string})|null)=>void,onError?:ListenerError)=>onSnapshot(doc(db,'conversations',id),d=>cb(d.exists()?{id:d.id,...d.data()} as Conversation&{id:string}:null),error=>{cb(null);onError?.(error);});
export const watchMessages=(id:string,cb:(m:(ConversationMessage&{id:string})[])=>void,onError?:ListenerError)=>onSnapshot(query(collection(db,'conversations',id,'messages'),orderBy('seq','desc'),limit(100)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()} as ConversationMessage&{id:string})).reverse()),error=>{cb([]);onError?.(error);});
export function watchPresence(id:string,cb:(p:(Presence&{uid:string})[])=>void,onError?:ListenerError) {
 return onSnapshot(collection(db,'conversations',id,'presence'),s=>cb(s.docs.map(d=>({uid:d.id,state:d.data().state,at:d.data().at?.toDate?.().toISOString()||''} as Presence&{uid:string})).filter(p=>Date.now()-Date.parse(p.at)<45000)),error=>{cb([]);onError?.(error);});
}
async function api(action:string,data:object) {
 const user=auth.currentUser;if(!user)throw new Error('سجل دخولك الأول');
 const r=await fetch(WORKER+'/crm/staff/'+action,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify(data)});
 const b=await r.json();if(!r.ok)throw new Error(b.error==='not_assignee'?'المحادثة مش مسندة ليك':b.error==='ai_unavailable'?'المساعد مش متاح. اكتب الرد يدويًا.':'تعذر تنفيذ العملية. راجع الاتصال والصلاحيات.');return b;
}
// Durable same-browser retry identity, bound to UID/conversation/payload.
async function mutate(action:string,id:string,data:object) {
 const key=await fingerprint((auth.currentUser?.uid||'')+'|'+action+'|'+id+'|'+JSON.stringify(data));
 const request_id=pendingId(localStorage,key,()=>crypto.randomUUID());
 const result=await api(action,{conversation_id:id,request_id,...data});clearPending(localStorage,key);return result;
}
export const sendReply=async(id:string,body:string)=>{await mutate('reply',id,{body});};
export const addNote=async(id:string,body:string)=>{await mutate('note',id,{body});};
export const assignConversation=async(id:string,assignee_uid:string|null,department_id?:string|null)=>{await mutate('assign',id,{assignee_uid,...(department_id!==undefined?{department_id}:{})});};
export const setConversationStatus=async(id:string,status:Conversation['status'],snoozed_until:string|null=null)=>{await mutate('status',id,{status,snoozed_until});};
export const setConversationTags=async(id:string,tags:string[])=>{await mutate('tags',id,{tags});};
export const heartbeat=async(id:string,state:Presence['state'])=>{const uid=auth.currentUser?.uid;if(uid)await setDoc(doc(db,'conversations',id,'presence',uid),{state,at:serverTimestamp()});};
export const clearPresence=async(id:string)=>{const uid=auth.currentUser?.uid;if(uid)await deleteDoc(doc(db,'conversations',id,'presence',uid));};
export async function loadCustomer(conversationId:string):Promise<(Customer&{id:string})|null> {return (await api('customer',{conversation_id:conversationId})).customer;}
export const recordView=async(id:string)=>{await mutate('view',id,{});};
export const suggestReply=async(id:string):Promise<string> =>(await api('ai/suggest-reply',{conversation_id:id,request_id:crypto.randomUUID()})).draft;
export const watchSavedReplies=(cb:(r:(SavedReply&{id:string})[])=>void,onError?:ListenerError)=>onSnapshot(collection(db,'savedReplies'),s=>cb(s.docs.map(d=>({id:d.id,...d.data()} as SavedReply&{id:string}))),error=>{cb([]);onError?.(error);});

export const sendOrderReady=async(id:string,order_id:string)=>{await mutate('order-ready',id,{order_id});};
