export function pinnedOwner(user:{uid:string;emailVerified:boolean}|null|undefined,pinnedUid:string|undefined):boolean;
export function guardedListener<T>(subscribe:(cb:(value:T)=>void)=>()=>void,onValue:(value:T)=>void):()=>void;
