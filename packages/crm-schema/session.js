export function pinnedOwner(user,pinnedUid){return !!pinnedUid && !!user && user.uid===pinnedUid && user.emailVerified===true;}
// Discard callbacks from a prior auth/conversation subscription immediately.
export function guardedListener(subscribe,onValue){let active=true;const cleanup=subscribe(value=>{if(active)onValue(value);});return ()=>{active=false;cleanup();};}
