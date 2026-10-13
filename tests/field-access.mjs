import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,name text,bucket_id text);
    create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert on storage.objects to authenticated;
  `);
  await db.exec(fs.readFileSync("supabase/schema.sql", "utf8").replace("create extension if not exists pgcrypto;", ""));
  if (process.argv.includes("--patch")) {
    // Exercise upgrading the original helper, including preservation of its ACL.
    await db.exec(`create or replace function private.can_work_incident(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce(private.can_read_incident(p_id) and private.my_role() in ('administrator','center_lead','dispatcher','field_staff'),false)$$;`);
    const privileges = async () => (await db.query("select proacl::text as acl from pg_proc where oid='private.can_work_incident(uuid)'::regprocedure")).rows[0].acl;
    const before = await privileges();
    await db.exec(fs.readFileSync("supabase/field-access-fix.sql", "utf8"));
    assert.equal(await privileges(), before, "SQL patch preserves function grants");
  }

  const org = crypto.randomUUID(), otherOrg = crypto.randomUUID();
  const center = crypto.randomUUID(), field = crypto.randomUUID(), other = crypto.randomUUID();
  const staff = crypto.randomUUID(), incident = crypto.randomUUID(), photo = crypto.randomUUID();
  await db.exec(`
    insert into auth.users(id) values('${center}'),('${field}'),('${other}');
    insert into public.organizations(id,name) values('${org}','Center'),('${otherOrg}','Other center');
    insert into public.users(id,organization_id,name,role) values
      ('${center}','${org}','Dispatcher','dispatcher'),
      ('${field}','${org}','Field staff','field_staff'),
      ('${other}','${otherOrg}','Other staff','field_staff');
    insert into public.staff(id,organization_id,user_id,name,position) values('${staff}','${org}','${field}','Staff','Rescue');
    insert into public.incidents(id,organization_id,type,title,address,lat,lng,channel,created_by,status)
      values('${incident}','${org}','Rescue','Incident','Address',18,99,'Phone','${center}','ออกปฏิบัติการ');
    insert into public.incident_staff(incident_id,staff_id,organization_id) values('${incident}','${staff}','${org}');
    set role authenticated;
  `);
  const asUser = async (user) => db.query("select set_config('app.user_id',$1,false)", [user]);
  const call = async (name, args) => (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`, args)).rows[0].result;
  const access = async () => (await db.query("select private.can_read_incident($1) as read, private.can_work_incident($1) as work", [incident])).rows[0];
  const version = async () => (await db.query("select version from public.incidents where id=$1", [incident])).rows[0].version;
  const save = async () => call("save_incident_result", [crypto.randomUUID(), incident, await version(), "Rescued", "None", "None", "Commander"]);
  const storagePath = `${org}/${incident}/${photo}.jpg`;

  await asUser(field);
  assert.deepEqual(await access(), { read: true, work: true }, "active assigned field staff can work");
  await save();
  await call("set_incident_check", [crypto.randomUUID(), incident, "Safety", true, await version()]);
  await call("attach_incident_photos", [crypto.randomUUID(), incident, [{ id: photo, phase: "ระหว่างดำเนินการ", storage_path: storagePath, at: new Date().toISOString() }], true, await version()]);
  await call("update_photo_description", [crypto.randomUUID(), incident, photo, "Active assignment", await version()]);
  await db.query("insert into storage.objects(id,name,bucket_id) values($1,$2,'incident-photos')", [photo, storagePath]);
  await call("transition_incident", [crypto.randomUUID(), incident, await version(), "ถึงเหตุ", null]);

  await db.exec(`reset role; update public.incident_staff set released_at=now() where incident_id='${incident}'; set role authenticated;`);
  assert.deepEqual(await access(), { read: true, work: false }, "released field staff retain historical read but lose write access");
  assert.equal((await db.query("select count(*)::int as n from public.incidents where id=$1", [incident])).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from public.incident_photos where incident_id=$1", [incident])).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from storage.objects")).rows[0].n, 1);
  const before = (await db.query("select * from public.incidents where id=$1", [incident])).rows[0];
  await assert.rejects(save, /FORBIDDEN/);
  await assert.rejects(() => call("set_incident_check", [crypto.randomUUID(), incident, "Safety", false, before.version]), /FORBIDDEN/);
  await assert.rejects(() => call("attach_incident_photos", [crypto.randomUUID(), incident, [], true, before.version]), /FORBIDDEN/);
  await assert.rejects(() => call("update_photo_description", [crypto.randomUUID(), incident, photo, "Released edit", before.version]), /FORBIDDEN/);
  await assert.rejects(() => call("transition_incident", [crypto.randomUUID(), incident, before.version, "ดำเนินการ", null]), /FORBIDDEN/);
  await assert.rejects(() => db.query("insert into storage.objects(id,name,bucket_id) values($1,$2,'incident-photos')", [crypto.randomUUID(), `${org}/${incident}/released.jpg`]), /row-level security/);
  assert.deepEqual((await db.query("select * from public.incidents where id=$1", [incident])).rows[0], before, "denied mutations preserve incident");
  assert.equal((await db.query("select checked from public.incident_checklist_items where incident_id=$1", [incident])).rows[0].checked, true);
  assert.equal((await db.query("select description from public.incident_photos where id=$1", [photo])).rows[0].description, "Active assignment");

  await asUser(other);
  assert.deepEqual(await access(), { read: false, work: false }, "other organization cannot access incident");
  await assert.rejects(() => call("save_incident_result", [crypto.randomUUID(), incident, before.version, "Other org", "", "", ""]), /FORBIDDEN/);
  await asUser(center);
  assert.deepEqual(await access(), { read: true, work: true }, "center staff can work without field assignment");
  await save();

  await db.exec(`reset role; update public.incident_staff set released_at=null where incident_id='${incident}'; update public.staff set deleted_at=now() where id='${staff}'; set role authenticated;`);
  await asUser(field);
  assert.equal((await access()).work, false, "deleted staff cannot work even with active assignment");
  await assert.rejects(save, /FORBIDDEN/);
  await db.exec(`reset role; update public.staff set deleted_at=null where id='${staff}'; update auth.users set email_confirmed_at=null where id='${field}'; set role authenticated;`);
  assert.deepEqual(await access(), { read: false, work: false }, "unconfirmed user cannot access incident");
  await db.exec(`reset role; update auth.users set email_confirmed_at=now() where id='${field}'; update public.users set deleted_at=now() where id='${field}'; set role authenticated;`);
  assert.deepEqual(await access(), { read: false, work: false }, "deleted user cannot access incident");
  await db.exec(`reset role; update public.users set deleted_at=null,role='report_viewer' where id='${field}'; set role authenticated;`);
  assert.deepEqual(await access(), { read: true, work: false }, "report viewer cannot work");
  console.log(`PASS: authenticated active/released field access, mutation guards, storage RLS, historical reads, organization, center, deleted staff/user, confirmation, role${process.argv.includes("--patch") ? ", SQL patch" : ""}`);
} finally {
  await db.close();
}
