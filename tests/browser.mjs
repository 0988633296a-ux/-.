import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["geolocation"],
  geolocation: { latitude: 18.898, longitude: 99.012 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.DRC_TEST_URL || "http://localhost:3000");
await page.waitForSelector(".leaflet-container", { timeout: 30000 });
await page.screenshot({ path: "/tmp/drc-desktop.png", fullPage: true });
assert.equal(await page.locator(".kpi").count(), 4);
await page
  .getByRole("button", { name: "แจ้งเหตุ", exact: true })
  .first()
  .click();
const dialog = page.getByRole("dialog");
await dialog.getByLabel("ชื่อเหตุ", { exact: true }).fill("ต้นไม้ล้มทดสอบวงจร");
await dialog
  .getByLabel("สถานที่ / รายละเอียดจุดเกิดเหตุ")
  .fill("ถนนชุมชน หมู่ 3 ตำบลหนองหาร");
await dialog.getByRole("button", { name: "ใช้ตำแหน่งปัจจุบัน" }).click();
await dialog.getByLabel("ละติจูด").toHaveValue?.("18.898");
await dialog.getByRole("button", { name: "บันทึกรับแจ้งเหตุ" }).click();
await page.waitForSelector(".next-status");
await page.getByRole("button", { name: "ตรวจสอบเหตุ" }).click();
await page
  .getByRole("button", { name: "จัดกำลัง", exact: false })
  .filter({ has: page.locator("svg") })
  .first()
  .click();
await page.locator(".next-status").click();
assert.match(await page.locator(".toast").textContent(), /มอบหมาย/);
await page
  .getByRole("dialog")
  .getByRole("button", { name: /พิมพ์ใจ สุขดี/ })
  .click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: /รถน้ำ 03/ })
  .click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: /เครื่องสูบน้ำ/ })
  .click();
await page.getByRole("button", { name: "Checklist", exact: true }).click();
for (const b of await page.locator(".checklist-row").all()) await b.click();
await page.locator(".next-status").click();
await page.locator(".next-status").click();
await page.locator(".next-status").click();
await page.getByRole("button", { name: "ภาพหน้างาน", exact: true }).click();
await page
  .locator(".upload-box input")
  .setInputFiles({
    name: "ภาพก่อน.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTc8AAAAASUVORK5CYII=",
      "base64",
    ),
  });
await page.waitForSelector(".photo-card");
await page.locator(".next-status").click();
await page.locator(".next-status").click();
assert.match(await page.locator(".toast").textContent(), /ผลการดำเนินงาน/);
await page
  .getByRole("dialog")
  .getByLabel("การดำเนินงานและผลลัพธ์")
  .fill("ตัดต้นไม้และเปิดการจราจรเรียบร้อย");
await page.getByRole("dialog").getByLabel("ผู้ควบคุมเหตุ").fill("สมชาย ใจดี");
await page.getByRole("button", { name: "บันทึกผลการดำเนินงาน" }).click();
await page.locator(".next-status").click();
assert.equal(await page.locator(".next-status").count(), 0);
const result = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("drc-demo-v1")),
);
const incident = result.incidents.find((i) => i.title === "ต้นไม้ล้มทดสอบวงจร");
assert.equal(incident.status, "เสร็จสิ้น");
assert.equal(incident.timeline.length, 8);
assert.equal(incident.photos.length, 1);
assert.equal(
  result.staff.find((s) => s.name === "พิมพ์ใจ สุขดี").status,
  "พร้อม",
);
assert.equal(
  result.vehicles.find((v) => v.name === "รถน้ำ 03").status,
  "พร้อม",
);
const popupPromise = page.waitForEvent("popup");
await page.getByRole("button", { name: "ดูรายงาน / พิมพ์ / PDF" }).click();
const popup = await popupPromise;
await popup.waitForSelector("h1");
await popup.evaluate(() => document.fonts.ready);
assert.match(
  await popup.locator("body").textContent(),
  /ตัดต้นไม้และเปิดการจราจรเรียบร้อย/,
);
await popup.pdf({
  path: "/tmp/drc-report.pdf",
  format: "A4",
  printBackground: true,
});
await popup.close();
await page.getByRole("button", { name: "ปิดหน้าต่าง" }).click();
await page.reload();
await page.waitForSelector(".incident-row");
assert.match(
  await page.locator(".incident-row").first().textContent(),
  /ต้นไม้ล้มทดสอบวงจร/,
);
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth),
  390,
);
await page.screenshot({ path: "/tmp/drc-mobile.png", fullPage: true });
for (const label of ["เหตุ", "แผนที่", "ทรัพยากร", "เพิ่มเติม", "หน้าหลัก"]) {
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: label, exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
}
assert.deepEqual(errors, []);
console.log(
  "PASS: desktop/mobile layout, full incident workflow, dispatch guard, staff/vehicle/equipment, GPS, checklist, photos, status history, close guard, resource release, Thai PDF, persisted reload, navigation",
);
await browser.close();
