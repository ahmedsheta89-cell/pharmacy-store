// Test-only SDK initialization. No production import reaches this module.
import {initializeApp,SDK_VERSION} from 'firebase/app';
Object.assign(globalThis,{__photoSdkVersion:SDK_VERSION});
import {getAuth,connectAuthEmulator} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator} from 'firebase/firestore';
const app=initializeApp({apiKey:'demo-only-key',projectId:'demo-photo-check',appId:'demo-only-app'});
connectAuthEmulator(getAuth(app),'http://127.0.0.1:9107',{disableWarnings:true});
connectFirestoreEmulator(getFirestore(app),'127.0.0.1',8117);
export * from '../src/lib/firebase.ts?real';
