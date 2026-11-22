import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCheckoutPhone} from '../src/lib/checkoutPhone.ts';
const valid = value => /^(\+?20)?0?1[0-9]{9}$/.test(normalizeCheckoutPhone(value));
test('Arabic digits produce the same phone as Western digits',()=>{
  for (const [input,expected] of [['٠١٠١٢٣٤٥٦٧٨','01012345678'],['01012345678','01012345678'],['٠١٠ ١٢٣٤-٥٦٧٨','01012345678'],['+٢٠ ١٠١٢٣٤٥٦٧٨','+201012345678'],['٢٠١٠١٢٣٤٥٦٧٨','201012345678'],['01٠١٢٣٤5678','01012345678']]) {
    assert.equal(normalizeCheckoutPhone(input),expected); assert.ok(valid(input));
  }
});
test('conversion is idempotent and maps each digit exactly',()=>{
  assert.equal(normalizeCheckoutPhone('٠١٢٣٤٥٦٧٨٩'),'0123456789');
  const phone=normalizeCheckoutPhone('+٢٠ ١٠١٢٣٤٥٦٧٨');assert.equal(normalizeCheckoutPhone(phone),phone);
});
test('invalid input is not repaired by stripping letters or punctuation',()=>{
  for (const input of ['', '٠١٠١٢٣٤٥٦٧', '٠١٠١٢٣٤٥٦٧٨٩','٠١٠١٢٣٤٥٦٧٨abc','01012345678/','+٤٤١٠١٢٣٤٥٦٧٨','٠٢١٢٣٤٥٦٧٨٩']) assert.equal(valid(input),false,input);
});
