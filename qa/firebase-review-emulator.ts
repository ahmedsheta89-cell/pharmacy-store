// Synthetic, disposable Auth/Firestore initialization. Never used by production.
import {initializeApp,SDK_VERSION} from 'firebase/app';
import {getAuth,connectAuthEmulator} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator} from 'firebase/firestore';
Object.assign(globalThis,{__reviewSdkVersion:SDK_VERSION});
const app=initializeApp({apiKey:'demo-only-key',projectId:'demo-review-check',appId:'demo-only-app'});
connectAuthEmulator(getAuth(app),'http://127.0.0.1:9108',{disableWarnings:true});
connectFirestoreEmulator(getFirestore(app),'127.0.0.1',8118);
export * from '../src/lib/firebase.ts?real';
