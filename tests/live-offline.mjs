import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600, aud: 'authenticated' })).toString('base64url'), 'mock'].join('.');
const session = { access_token: jwt, refresh_token: 'mock-refresh', expires_in: 3600, token_type: 'bearer', user };
let deny = true, noProfile = false, updates = 0;
await page.route('https://zkmaubtpxiptbbqtazfr.supabase.co/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  let status = 200, body = {};
  if (url.pathname.endsWith('/token')) {
    if (deny) { status = 400; body = { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' }; }
    else body = session;
  } else if (url.pathname.endsWith('/user')) {
    if (request.method() === 'PUT') { updates++; assert.equal(request.postDataJSON().password, 'new-test-password-1234'); }
    body = user;
  } else if (url.pathname.includes('/rest/v1/users')) {
    if (noProfile) { status = 406; body = { code: 'PGRST116', message: 'no row' }; }
    else body = { id: user.id, organization_id: '22222222-2222-4222-8222-222222222222', name: 'เจ้าหน้าที่ทดสอบ', role: 'dispatcher' };
  } else if (url.pathname.includes('/rest/v1/organizations')) body = { name: 'ศูนย์ทดสอบ' };
  else if (url.pathname.includes('/rest/v1/')) body = [];
  await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: JSON.stringify(body) });
});

deny=false;
await page.goto('http://localhost:3001');
await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();
let dialog=page.getByRole('dialog');
await dialog.getByLabel('อีเมล',{exact:true}).fill('test@example.com');
await dialog.getByLabel('รหัสผ่าน',{exact:true}).fill('valid-test-password');
await dialog.getByRole('button',{name:'เข้าสู่ระบบและเปิดข้อมูลจริง'}).click();
await page.getByRole('button',{name:'บัญชีผู้ใช้',exact:true}).waitFor();
await page.getByRole('button',{name:'บัญชีผู้ใช้',exact:true}).click();
const oldConnection=await page.evaluate(()=>localStorage.getItem('drc-connection'));
await page.getByLabel('Supabase Project URL').fill('https://other-project.supabase.co');
await page.getByRole('button',{name:'บันทึกการเชื่อมต่อ',exact:true}).click();
assert.equal(await page.evaluate(()=>localStorage.getItem('drc-connection')),oldConnection,'Active account connection must not be replaced');
await page.evaluate(uid=>{
 localStorage.setItem('drc-outbox-'+uid,JSON.stringify([{id:'legacy-command',kind:'legacy-unknown',userId:uid}]));
 localStorage.setItem('drc-outbox-v2:'+encodeURIComponent('https://zkmaubtpxiptbbqtazfr.supabase.co')+':'+uid,JSON.stringify([{id:'existing-command',kind:'test-pending',userId:uid}]));
 const cached=JSON.parse(localStorage.getItem('drc-live-v2:'+encodeURIComponent('https://zkmaubtpxiptbbqtazfr.supabase.co')+':'+uid));
 const sample=JSON.parse(localStorage.getItem('drc-demo-v1')).incidents[0];
 sample.title='เหตุจริงที่เก็บออฟไลน์';sample.number='DRC-REAL';sample.demo=false;
 cached.incidents=[sample];localStorage.setItem('drc-live-v2:'+encodeURIComponent('https://zkmaubtpxiptbbqtazfr.supabase.co')+':'+uid,JSON.stringify(cached));
},user.id);
await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}));
await page.reload();await page.locator('.fab').waitFor();
await page.waitForTimeout(350);
assert.equal(await page.getByRole('button',{name:'บัญชีผู้ใช้',exact:true}).count(),1,'Offline startup must restore authenticated live workspace');
assert.match(await page.locator('body').innerText(),/เหตุจริงที่เก็บออฟไลน์/);
assert.equal(await page.locator('.incident-row').count(),1);
assert.equal(await page.evaluate(()=>localStorage.getItem('drc-mode')),'live');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
await page.locator('.fab').click();
const intake=page.getByRole('dialog');
await intake.getByLabel('ชื่อเหตุ',{exact:true}).fill('เหตุใหม่ขณะออฟไลน์');
await intake.getByLabel('สถานที่ / รายละเอียดจุดเกิดเหตุ').fill('ทดสอบระบบออฟไลน์');
await intake.getByLabel('ละติจูด').fill('16.7');
await intake.getByLabel('ลองจิจูด').fill('103.7');
await intake.getByRole('button',{name:'บันทึกรับแจ้งเหตุ'}).click();
const queue=await page.evaluate(uid=>JSON.parse(localStorage.getItem('drc-outbox-v2:'+encodeURIComponent('https://zkmaubtpxiptbbqtazfr.supabase.co')+':'+uid)),user.id);
assert.equal(queue.length,2);
assert.equal(await page.evaluate(uid=>JSON.parse(localStorage.getItem('drc-outbox-'+uid))[0].id,user.id),'legacy-command');
assert.equal(queue[0].id,'existing-command');
assert.equal(queue[1].kind,'รับแจ้งเหตุ');
assert.equal(queue[1].userId,user.id);
assert.equal(queue[1].after.demo,false);
await browser.close();
console.log('PASS offline authenticated workspace restoration');
