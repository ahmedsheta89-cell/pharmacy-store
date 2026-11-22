// Synthetic QA only. The production config never imports this file.
export * from '/src/lib/firebase.ts?real';
const PRODUCT_NAMES=['عبوة عناية تجريبية','مستلزمات يومية تجريبية','مجموعة عناية تجريبية','عبوة ترطيب تجريبية','مستلزمات أطفال تجريبية','أداة عناية تجريبية'];
const products=PRODUCT_NAMES.map((name,i)=>({id:'fixture-'+i,name,nameEn:'Visual QA fixture',category:['skincare','hygiene','haircare','skincare','baby','devices'][i],price:45+i*40,unit:'عبوة',stock_quantity:10,description:'بيانات تجريبية للمعاينة البصرية فقط. ليست منتجات معروضة للبيع.',public_visible:true,content_review_status:'reviewed',advertising_status:'approved',prescription_status:'not_medicine',content_reviewed_at:'2026-11-21',content_version:1,content_source:'Synthetic visual fixture'}));
const emit=(cb,value)=>{queueMicrotask(()=>cb(value));return ()=>{};};
let appearance=JSON.parse(localStorage.getItem('qa-appearance')||'{"theme":"royal-amethyst","accepting_orders":true,"closed_message":"استقبال الطلبات متوقف مؤقتًا، نسخة اختبار."}');
let appearanceListeners=new Set();
export const watchStoreAppearance=(cb)=>{appearanceListeners.add(cb);queueMicrotask(()=>cb(appearance));const fn=e=>{if(e.key==='qa-appearance'){appearance=JSON.parse(e.newValue);cb(appearance);}};addEventListener('storage',fn);return ()=>{appearanceListeners.delete(cb);removeEventListener('storage',fn);};};
import {parseAppearance} from '/src/lib/themes.ts';
appearance=parseAppearance(appearance);
export const saveStoreAppearance=async value=>{appearance={...value};localStorage.setItem('qa-appearance',JSON.stringify(appearance));appearanceListeners.forEach(cb=>cb(appearance));};
export const watchAuth=cb=>emit(cb,{uid:'qa-owner',email:'ahmedsheta89@gmail.com'});
import {derivedVisibility,eligibleForDisplay} from '/src/lib/productVisibility.ts';
products[1].owner_hidden=true;products[1].public_visible=false;products[2].content_review_status='unreviewed';products[2].public_visible=false;
const productListeners=new Set();
export const watchProducts=(cb,manager=false)=>{const notify=()=>cb(manager?[...products]:products.filter(p=>p.public_visible&&derivedVisibility(p)));productListeners.add(notify);queueMicrotask(notify);return ()=>productListeners.delete(notify);};
export const getPublicProduct=async id=>products.find(p=>p.id===id&&p.public_visible&&derivedVisibility(p))||null;
export const setProductHidden=async(id,hidden)=>{const p=products.find(p=>p.id===id);p.owner_hidden=hidden;p.public_visible=derivedVisibility(p);productListeners.forEach(cb=>cb());};
export const watchOrders=cb=>emit(cb,[]),watchFeedback=cb=>emit(cb,[]),watchBanners=cb=>emit(cb,[{id:'qa-banner',title:'مساحة إعلان من الصيدلية',text:'بانر تجريبي للمعاينة فقط. تضيف الصورة والنص والرابط وتوقف ظهوره من لوحة الإدارة.',enabled:true,linkUrl:'/#catalog',linkLabel:'شوف المنتجات التجريبية'}]);
export const managerSignOut=async()=>{},managerSignIn=async()=>{};
export const lookupOrder=async()=>({status:'preparing',total:125,created_at:new Date().toISOString()}),placeOrder=async()=>({ok:true,orderCode:'QA-NOT-REAL'});
globalThis.__appearanceFixture={set(value){appearance={...appearance,...value};localStorage.setItem('qa-appearance',JSON.stringify(appearance));appearanceListeners.forEach(cb=>cb(appearance));}};

// Never permit a visual fixture to call a production mutation, even accidentally.
const blocked=async()=>{throw new Error('Visual QA mutation is disabled');};
export const managerSendPasswordReset=blocked,upsertProduct=blocked,deleteProductById=blocked,seedProducts=blocked,saveBanner=blocked,deleteBanner=blocked,setOrderStatus=blocked,setExpectedDelivery=blocked,submitFeedback=blocked,bulkImportProducts=blocked;
