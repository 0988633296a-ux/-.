import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";

const path = new URL("../src/lib/incident-drafts.ts", import.meta.url);
assert.ok(
  existsSync(path),
  "scoped draft and immediate photo persistence helpers must exist",
);
const source = ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const helpers = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const {
  incidentDraftKey,
  readIncidentDraft,
  writeIncidentDraft,
  validateIncidentPhoto,
  persistDraftPhotos,
} = helpers;
assert.notEqual(
  incidentDraftKey("org/account-a", true),
  incidentDraftKey("org/account-b", true),
);
assert.notEqual(
  incidentDraftKey("org/account-a", true),
  incidentDraftKey("org/account-a", false),
);
assert.equal(
  incidentDraftKey(undefined, true),
  null,
  "unscoped live sessions must never restore another account",
);
const entries = new Map([
  ["drc-incident-draft", JSON.stringify({ title: "legacy private" })],
]);
const storage = {
  getItem: (key) => entries.get(key) ?? null,
  setItem: (key, value) => entries.set(key, value),
};
const key = incidentDraftKey("org/account-a", true);
assert.equal(
  readIncidentDraft(storage, key),
  null,
  "legacy drafts cannot migrate implicitly",
);
const draft = { reportedAt: "2026-10-12T09:00", title: "historical" };
writeIncidentDraft(
  storage,
  key,
  draft,
  [{ id: "saved-photo", name: "evidence.jpg", at: "2026-10-12T09:01:00Z" }],
  "2026-10-12T09:02:00Z",
);
const recovered = readIncidentDraft(storage, key);
assert.deepEqual(
  recovered.draft,
  draft,
  "recovery preserves deliberately historical incident time",
);
assert.equal(recovered.savedAt, "2026-10-12T09:02:00Z");
assert.equal(recovered.photos[0].id, "saved-photo");
assert.equal(
  readIncidentDraft(storage, incidentDraftKey("org/account-b", true)),
  null,
);
for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic"])
  assert.equal(validateIncidentPhoto({ type, size: 1 }), null);
for (const type of [
  "image/gif",
  "image/svg+xml",
  "image/avif",
  "image/heif",
  "",
])
  assert.match(validateIncidentPhoto({ type, size: 1 }), /JPEG/);
assert.match(
  validateIncidentPhoto({ type: "image/jpeg", size: 15 * 1024 * 1024 + 1 }),
  /15 MB/,
);
let writes = [];
await assert.rejects(
  persistDraftPhotos(
    [{ type: "image/gif", size: 1, name: "bad.gif" }],
    async (...args) => writes.push(args),
    () => "id",
  ),
  /JPEG/,
);
assert.equal(writes.length, 0, "unsupported files rejected before storing");
let release;
const saving = persistDraftPhotos(
  [{ type: "image/jpeg", size: 1, name: "a.jpg" }],
  async (id, file) => {
    writes.push([id, file]);
    await new Promise((resolve) => {
      release = resolve;
    });
  },
  () => "stored-id",
);
await Promise.resolve();
let settled = false;
saving.then(() => {
  settled = true;
});
await Promise.resolve();
assert.equal(
  settled,
  false,
  "photo metadata cannot be marked ready before durable blob storage completes",
);
release();
const photos = await saving;
assert.equal(photos[0].id, "stored-id");
assert.equal(photos[0].name, "a.jpg");
await assert.rejects(
  persistDraftPhotos(
    [{ type: "image/png", size: 1, name: "a.png" }],
    async () => {
      throw Error("disk full");
    },
    () => "failed",
  ),
  /disk full/,
);
console.log(
  "Incident draft tests passed: isolated scopes, historical recovery, photo references, MIME/size validation, durable writes and storage failure.",
);

if (process.env.DRC_TEST_URL) {
  const { chromium, expect } = await import("@playwright/test");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.DRC_TEST_URL);
    await page.evaluate(() =>
      localStorage.setItem(
        "drc-incident-draft",
        JSON.stringify({ title: "private legacy incident" }),
      ),
    );
    const open = async () => {
      await page
        .getByRole("button", { name: "แจ้งเหตุ", exact: true })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
    };
    await open();
    let dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("ชื่อเหตุ", { exact: true })).toHaveValue(
      "",
    );
    await dialog
      .getByLabel("ชื่อเหตุ", { exact: true })
      .fill("Recovered evidence draft");
    await dialog.getByLabel("วันเวลารับแจ้ง").fill("2026-10-12T09:00");
    await dialog.locator("input[type=file]").setInputFiles({
      name: "evidence.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTc8AAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(dialog.locator(".upload-small")).toContainText(
      "1 ภาพที่เก็บในร่าง",
    );
    await expect(dialog.locator('img[alt="evidence.png"]')).toBeVisible();
    await dialog.getByRole("button", { name: "เก็บร่าง / ปิด" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await open();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("ชื่อเหตุ", { exact: true })).toHaveValue(
      "Recovered evidence draft",
    );
    await expect(dialog.getByLabel("วันเวลารับแจ้ง")).toHaveValue(
      "2026-10-12T09:00",
    );
    await expect(dialog).toContainText("กู้คืนร่างที่บันทึกไว้");
    await expect(dialog.locator('img[alt="evidence.png"]')).toBeVisible();
    await dialog
      .getByRole("button", { name: "ใช้เวลาปัจจุบัน", exact: true })
      .click();
    await expect(dialog.getByLabel("วันเวลารับแจ้ง")).not.toHaveValue(
      "2026-10-12T09:00",
    );
    await dialog.locator("input[type=file]").setInputFiles({
      name: "bad.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
    await expect(page.locator(".toast")).toContainText("JPEG");
    await expect(dialog.locator(".upload-small")).toContainText(
      "1 ภาพที่เก็บในร่าง",
    );
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("drc-incident-draft")).title,
      ),
      "private legacy incident",
    );
    await page.evaluate(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (success, error) => {
            window.delayedGps = { success, error };
          },
        },
      });
    });
    await dialog
      .getByRole("button", { name: "ใช้ตำแหน่งปัจจุบัน", exact: true })
      .click();
    await dialog.getByRole("button", { name: "เก็บร่าง / ปิด" }).click();
    await open();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("ชื่อเหตุ", { exact: true })
      .fill("Newer draft must survive old GPS");
    const newerDraft = await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(([key]) =>
          key.startsWith("drc-incident-draft-v2:"),
        ),
      ),
    );
    await page.evaluate(() =>
      window.delayedGps.success({ coords: { latitude: 20, longitude: 100 } }),
    );
    assert.deepEqual(
      await page.evaluate(() =>
        Object.fromEntries(
          Object.entries(localStorage).filter(([key]) =>
            key.startsWith("drc-incident-draft-v2:"),
          ),
        ),
      ),
      newerDraft,
      "GPS callback from a closed form cannot overwrite a newer draft in the same scope",
    );
    await page.evaluate(() => window.delayedGps.error());
    await expect(dialog.getByLabel("ชื่อเหตุ", { exact: true })).toHaveValue(
      "Newer draft must survive old GPS",
    );
    assert.deepEqual(errors, []);
    console.log(
      "Incident draft browser checks passed: legacy isolation, Blob restoration after close/reload, explicit time refresh and unsupported upload rejection.",
    );
  } finally {
    await browser.close();
  }
}
