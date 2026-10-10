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
    else body = { id: user.id, organization_id: '22222222-2222-4222-8222-222222222222', name: 'เจ้าหน้าที่ทดสอบ', role: 'report_viewer' };
  } else if (url.pathname.includes('/rest/v1/organizations')) body = { name: 'ศูนย์ทดสอบ' };
  else if (url.pathname.includes('/rest/v1/')) body = [];
  await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: JSON.stringify(body) });
});
await page.goto('http://localhost:3001');
await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
const dialog = page.getByRole('dialog');
await dialog.getByLabel('อีเมล', { exact: true }).fill('test@example.com');
await dialog.getByLabel('รหัสผ่าน', { exact: true }).fill('wrong-test-password');
await dialog.getByRole('button', { name: 'แสดงรหัสผ่าน' }).click();
assert.equal(await dialog.getByLabel('รหัสผ่าน', { exact: true }).getAttribute('type'), 'text');
await dialog.getByRole('button', { name: 'เข้าสู่ระบบและเปิดข้อมูลจริง' }).click();
await dialog.getByRole('alert').filter({ hasText: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }).waitFor();
assert.equal(await page.evaluate(() => localStorage.getItem('drc-mode')), null);
deny = false; noProfile = true;
await dialog.getByRole('button', { name: 'เข้าสู่ระบบและเปิดข้อมูลจริง' }).click();
await dialog.getByRole('alert').filter({ hasText: 'เปิดข้อมูลหน่วยงานไม่ได้' }).waitFor();
assert.equal(await page.evaluate(() => localStorage.getItem('drc-mode')), null);
noProfile = false;
await dialog.getByLabel('รหัสผ่าน', { exact: true }).fill('valid-test-password');
await dialog.getByRole('button', { name: 'เข้าสู่ระบบและเปิดข้อมูลจริง' }).click();
await page.getByRole('button', { name: 'บัญชีผู้ใช้', exact: true }).waitFor();
assert.equal(await page.evaluate(() => localStorage.getItem('drc-mode')), 'live');
assert.equal(await page.locator('.incident-row').count(), 0);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
await page.reload();
await page.getByRole('button', { name: 'บัญชีผู้ใช้', exact: true }).waitFor();
await page.getByRole('button', { name: 'บัญชีผู้ใช้', exact: true }).click();
await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();
await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).waitFor();
assert.equal(await page.evaluate(() => localStorage.getItem('drc-mode')), null);
await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
await dialog.getByRole('button', { name: 'ลืมรหัสผ่าน', exact: true }).click();
await dialog.getByLabel('อีเมล').fill('test@example.com');
await dialog.getByRole('button', { name: 'ส่งลิงก์ตั้งรหัสผ่านใหม่' }).click();
await dialog.getByRole('status').waitFor();
await page.goto('http://localhost:3001/?auth=recovery#access_token=' + jwt + '&refresh_token=mock-refresh&token_type=bearer&expires_in=3600&type=recovery');
await page.getByRole('dialog').getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }).waitFor();
await page.getByLabel('รหัสผ่านใหม่', { exact: true }).fill('new-test-password-1234');
await page.getByLabel('ยืนยันรหัสผ่าน', { exact: true }).fill('new-test-password-1234');
await page.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }).click();
await page.getByRole('button', { name: 'เริ่มใช้งาน', exact: true }).waitFor();
assert.equal(updates, 1);
assert.equal(new URL(page.url()).hash, '');
await page.goto('http://localhost:3001/?auth=recovery');
await page.getByRole('dialog').getByRole('alert').waitFor();
assert.equal(await page.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }).isDisabled(), true);
assert.equal(updates, 1);
assert.deepEqual(errors, []);
await browser.close();
console.log('Login failure, missing role, live opening, restore, logout, mobile and password recovery passed (mock Auth transport).');
