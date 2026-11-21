const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:390,height:844}});
const fresh=async path=>{await p.goto('http://127.0.0.1:5185'+path);await p.waitForTimeout(350);};
await fresh('/c/conv-12345678901234567890');assert.ok((await p.locator('body').innerText()).includes('عميل تجريبي'));
await p.locator('textarea').fill('مسودة سرية قديمة');await p.evaluate(()=>window.__crmFixtures.denyAssignment());await p.waitForTimeout(100);
let text=await p.locator('body').innerText();for(const old of ['عميل تجريبي','مسودة سرية','إبلاغ العميل','ملاحظة داخلية تجريبية'])assert.ok(!text.includes(old),old);assert.equal(await p.locator('textarea').count(),0);await p.screenshot({path:'/downloads/crm-v4-assignment-revoked.png',fullPage:true});
await fresh('/');assert.ok((await p.locator('body').innerText()).includes('عميل تجريبي'));await p.evaluate(()=>window.__crmFixtures.denyAssignment());await p.waitForTimeout(100);text=await p.locator('body').innerText();assert.ok(!text.includes('عميل تجريبي'));assert.ok(text.includes('راجع صلاحيات'));await p.screenshot({path:'/downloads/crm-v4-inbox-denied.png',fullPage:true});
await fresh('/c/conv-12345678901234567890');await p.evaluate(()=>window.__crmFixtures.revokeRole());await p.waitForTimeout(100);text=await p.locator('body').innerText();assert.ok(!text.includes('عميل تجريبي'));assert.ok(!text.includes('مشرف تجريبي'));assert.ok(text.includes('مش متفعّل'));await p.screenshot({path:'/downloads/crm-v4-role-revoked.png',fullPage:true});
console.log('PASS: assignment denied clears content/draft/actions; inbox denied clears old rows; role revoked removes owner interface');await b.close();})();
