import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let verifications = 0, updates = 0;
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600, aud: 'authenticated' })).toString('base64url'), 'mock'].join('.');
await page.route('https://zkmaubtpxiptbbqtazfr.supabase.co/**', async route => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  let response = {};
  if (path.endsWith('/verify')) {
    verifications++;
    assert.equal(request.postDataJSON().token_hash, 'fake-test-invitation');
    assert.equal(request.postDataJSON().type, 'invite');
    response = { access_token: jwt, refresh_token: 'mock-refresh', expires_in: 3600, token_type: 'bearer', user };
  } else if (path.endsWith('/user')) {
    if (request.method() === 'PUT') { updates++; assert.equal(request.postDataJSON().password, 'test-password-12345'); }
    response = user;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(response) });
});
await page.goto('http://localhost:3001/#invite=fake-test-invitation');
const dialog = page.getByRole('dialog');
await dialog.waitFor();
assert.equal(new URL(page.url()).hash, '');
await dialog.getByLabel('รหัสผ่านใหม่', { exact: true }).fill('test-password-12345');
await dialog.getByLabel('ยืนยันรหัสผ่าน', { exact: true }).fill('mismatch-password');
await dialog.getByRole('button', { name: 'ตั้งรหัสผ่านและเปิดใช้งาน' }).click();
await dialog.getByRole('alert').waitFor();
assert.equal(verifications, 0);
await dialog.getByLabel('ยืนยันรหัสผ่าน', { exact: true }).fill('test-password-12345');
await dialog.getByRole('button', { name: 'ตั้งรหัสผ่านและเปิดใช้งาน' }).click();
await dialog.getByRole('button', { name: 'เริ่มใช้งาน', exact: true }).waitFor();
assert.equal(verifications, 1); assert.equal(updates, 1);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
console.log('PASS: one-time invitation fragment removed, mismatched passwords blocked, verified invite sets password, mobile activation fits');
await browser.close();
