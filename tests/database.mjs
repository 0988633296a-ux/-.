import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz default now());create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,name text,bucket_id text);create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;`,
);
await db.exec(
  fs
    .readFileSync("supabase/schema.sql", "utf8")
    .replace("create extension if not exists pgcrypto;", ""),
);
const owner = "11111111-1111-4111-8111-111111111111";
const viewer = "22222222-2222-4222-8222-222222222222";
const org = "33333333-3333-4333-8333-333333333333";
const staff = "44444444-4444-4444-8444-444444444444";
const vehicle = "55555555-5555-4555-8555-555555555555";
const incident = "66666666-6666-4666-8666-666666666666";
let seq = 0;
const op = () => `99999999-9999-4999-8999-${String(++seq).padStart(12, "0")}`;
await db.exec(
  `insert into auth.users(id) values('${owner}'),('${viewer}');insert into public.organizations(id,name) values('${org}','ศูนย์ทดสอบ');insert into public.users(id,organization_id,name,role) values('${owner}','${org}','หัวหน้าศูนย์','administrator'),('${viewer}','${org}','ผู้ดูรายงาน','report_viewer');set app.user_id='${owner}';`,
);
const call = async (name, args) => {
  const params = args.map((_, i) => `$${i + 1}`).join(",");
  return (await db.query(`select public.${name}(${params}) as result`, args))
    .rows[0].result;
};
await call("save_resource", [
  op(),
  "staff",
  {
    id: staff,
    name: "เจ้าหน้าที่ทดสอบ",
    type: "กู้ภัย",
    status: "พร้อม",
    skills: ["กู้ภัย"],
  },
]);
await call("save_resource", [
  op(),
  "vehicles",
  {
    id: vehicle,
    name: "กู้ภัย 01",
    type: "รถกู้ภัย",
    status: "พร้อม",
    fuel: 100,
  },
]);
const createOp = op();
const data = {
  id: incident,
  type: "ต้นไม้ล้ม",
  title: "ต้นไม้ล้มขวางถนน",
  address: "ถนนทดสอบ",
  lat: 18.9,
  lng: 99.0,
  level: "เร่งด่วน",
  channel: "โทรศัพท์",
};
let i = await call("create_incident", [createOp, data]);
assert.equal(i.status, "รับแจ้ง");
const duplicate = await call("create_incident", [createOp, data]);
assert.equal(duplicate.id, i.id);
assert.equal(
  (await db.query("select count(*)::int as n from incidents")).rows[0].n,
  1,
);
i = await call("transition_incident", [
  op(),
  incident,
  i.version,
  "ตรวจสอบ",
  null,
]);
i = await call("transition_incident", [
  op(),
  incident,
  i.version,
  "จัดกำลัง",
  null,
]);
await assert.rejects(
  () =>
    call("transition_incident", [
      op(),
      incident,
      i.version,
      "ออกปฏิบัติการ",
      null,
    ]),
  /TEAM_VEHICLE_REQUIRED/,
);
i = await call("assign_resource", [
  op(),
  incident,
  "staff",
  staff,
  1,
  false,
  i.version,
]);
i = await call("assign_resource", [
  op(),
  incident,
  "vehicles",
  vehicle,
  1,
  false,
  i.version,
]);
await assert.rejects(
  () =>
    call("transition_incident", [
      op(),
      incident,
      i.version,
      "ออกปฏิบัติการ",
      null,
    ]),
  /CHECKLIST_INCOMPLETE/,
);
for (const { label } of (
  await db.query("select label from incident_checklist_items")
).rows)
  i = await call("set_incident_check", [
    op(),
    incident,
    label,
    true,
    i.version,
  ]);
const transitionOp = op();
const version = i.version;
i = await call("transition_incident", [
  transitionOp,
  incident,
  version,
  "ออกปฏิบัติการ",
  null,
]);
assert.equal(
  (
    await call("transition_incident", [
      transitionOp,
      incident,
      version,
      "ออกปฏิบัติการ",
      null,
    ])
  ).version,
  i.version,
);
await assert.rejects(
  () => call("transition_incident", [op(), incident, version, "ถึงเหตุ", null]),
  /VERSION_CONFLICT/,
);
for (const status of ["ถึงเหตุ", "ดำเนินการ", "ควบคุมเหตุได้"])
  i = await call("transition_incident", [
    op(),
    incident,
    i.version,
    status,
    null,
  ]);
await assert.rejects(
  () =>
    call("transition_incident", [op(), incident, i.version, "เสร็จสิ้น", null]),
  /REPORT_REQUIRED/,
);
i = await call("save_incident_result", [
  op(),
  incident,
  i.version,
  "ตัดต้นไม้ เปิดการจราจร",
  "ไม่มี",
  "ไม่มี",
  "หัวหน้าชุด",
]);
i = await call("transition_incident", [
  op(),
  incident,
  i.version,
  "เสร็จสิ้น",
  null,
]);
assert.equal(
  (await db.query("select status from vehicles")).rows[0].status,
  "พร้อม",
);
assert.equal(
  (await db.query("select count(*)::int as n from reports")).rows[0].n,
  1,
);
assert.ok(
  (await db.query("select count(*)::int as n from audit_logs")).rows[0].n > 10,
);
await db.exec(`set app.user_id='${viewer}';`);
await assert.rejects(
  () => call("create_incident", [op(), { ...data, id: crypto.randomUUID() }]),
  /FORBIDDEN/,
);
await assert.rejects(
  () => call("set_user_role", [owner, "administrator"]),
  /FORBIDDEN/,
);
await db.exec(`set app.user_id='${owner}';`);
await call("soft_delete_incident", [incident, "บันทึกทดสอบ"]);
assert.ok(
  (await db.query("select deleted_at from incidents")).rows[0].deleted_at,
);
console.log(
  "PASS: schema, full workflow, checklist enforcement, idempotency, optimistic locking, resource release, report snapshot, audit, role protection, soft delete",
);
await db.close();
