export function pendingId(storage:Storage,fingerprint:string,makeId:()=>string):string;
export function clearPending(storage:Storage,fingerprint:string):void;
export function fingerprint(value:string):Promise<string>;
