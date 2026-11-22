import test from 'node:test';
import assert from 'node:assert/strict';
import {RESET_REQUEST_ACCEPTED,passwordResetErrorMessage} from '../src/lib/passwordResetFeedback.ts';

test('accepted reset message is conditional and does not claim delivery',()=>{
 assert.match(RESET_REQUEST_ACCEPTED,/لو البريد مسجّل/);
 assert.match(RESET_REQUEST_ACCEPTED,/لا يؤكد إرسال الإيميل أو وصوله/);
 assert.doesNotMatch(RESET_REQUEST_ACCEPTED,/أرسلنا|تم إرسال|وصلت الرسالة/);
});
test('rate-limited reset asks for a pause, never says the email is wrong',()=>{
 const text=passwordResetErrorMessage({code:'auth/too-many-requests'});
 assert.match(text,/تقييد المحاولات مؤقتًا/);assert.doesNotMatch(text,/تأكد من البريد|أرسلنا/);
});
test('network failure is separate from invalid email syntax',()=>{
 assert.match(passwordResetErrorMessage({code:'auth/network-request-failed'}),/اتصال الإنترنت/);
 assert.match(passwordResetErrorMessage({code:'auth/invalid-email'}),/صيغة البريد/);
});
test('unknown errors never echo raw messages, credentials or account existence',()=>{
 for(const error of [undefined,null,'server details',{code:'auth/user-not-found',message:'SECRET-NOT-FOR-UI'},{code:'unrecognized',message:'SECRET-NOT-FOR-UI'}]){
  const text=passwordResetErrorMessage(error);assert.match(text,/تعذّر إكمال طلب/);assert.doesNotMatch(text,/SECRET|not-found|مسجل/);
 }
});
