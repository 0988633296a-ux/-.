import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const page=await context.newPage();
 await page.addInitScript(()=>{navigator.geolocation.getCurrentPosition=success=>{window.releaseGPS=()=>success({coords:{latitude:16.7,longitude:103.7}});};});
 await page.goto(process.env.DRC_TEST_URL||'http://localhost:3001');
 await page.locator('.incident-row').first().click();
 await page.getByRole('dialog').getByRole('button',{name:'ภาพหน้างาน',exact:true}).click();
 await page.locator('.upload-box input[type=file]').setInputFiles({name:'race.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2cS0AAAAASUVORK5CYII=','base64')});
 await page.waitForFunction(()=>!!window.releaseGPS);
 await page.getByRole('dialog').getByRole('button',{name:'Checklist',exact:true}).click();
 const row=page.locator('.checklist-row').first();
 assert.match(await row.getAttribute('class'),/checked/);
 await row.click();assert.ok(!(await row.getAttribute('class')).includes('checked'));
 await page.evaluate(()=>window.releaseGPS());
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('drc-demo-v1')).incidents.some(i=>i.photos.some(p=>p.description==='race.png')));
 assert.ok(!(await row.getAttribute('class')).includes('checked'),'GPS capture must preserve latest checklist change');
 console.log('PASS delayed photo GPS preserves intervening checklist change');
} finally {await browser.close();}
