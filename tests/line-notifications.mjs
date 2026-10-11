import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('supabase/functions/line-notify/message.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {notificationText,acceptedResponse}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const message=notificationText('critical_incident',{number:'DRC-2569-000001',type:'ไฟไหม้',level:'วิกฤต',address:'ถนน\nทดสอบ',lat:16.7,lng:103.7,reported_at:'2026-10-11T07:00:00Z',reporter:'PRIVATE',phone:'PRIVATE'});
assert.match(message,/เหตุวิกฤต/);assert.match(message,/14:00/);assert.match(message,/openstreetmap/);assert.ok(!message.includes('PRIVATE'));
assert.match(notificationText('line_connection_test',{}),/ไม่ใช่เหตุจริง/);
assert.equal(acceptedResponse(new Response('',{status:409})),false);
assert.equal(acceptedResponse(new Response('',{status:409,headers:{'x-line-accepted-request-id':'test'}})),true);
assert.equal(acceptedResponse(new Response('',{status:401})),false);
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz default now()); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key,name text,bucket_id text); create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;`);
await db.exec(fs.readFileSync('supabase/schema.sql','utf8').replace('create extension if not exists pgcrypto;',''));
await db.exec(fs.readFileSync('supabase/line-webhook.sql','utf8'));
await db.exec(fs.readFileSync('supabase/line-notifications.sql','utf8'));
const org='33333333-3333-4333-8333-333333333333',user='44444444-4444-4444-8444-444444444444';
await db.query('insert into organizations(id,name) values($1,$2)',[org,'ศูนย์ทดสอบ']);
await db.query('insert into auth.users(id) values($1)',[user]);
await db.query("insert into users(id,organization_id,name,role) values($1,$2,'ทดสอบ','administrator')",[user,org]);
await db.query("insert into line_group_connections(organization_id,group_id,enabled,approved_by,approved_at) values($1,$2,true,$3,now()-interval '1 minute')",[org,'C'+'a'.repeat(32),user]);
await db.query("insert into notification_outbox(organization_id,kind) values($1,'line_connection_test')",[org]);
const claim=async tenant=>(await db.query('select * from claim_line_notifications($1,10)',[tenant])).rows;
const jobs=await claim(org);assert.equal(jobs.length,1);
assert.equal((await claim(org)).length,0); // Live lease prevents overlap.
assert.equal((await claim('55555555-5555-4555-8555-555555555555')).length,0);
const job=jobs[0];
assert.equal((await db.query('select finish_line_notification($1,$2,true,null,null) as ok',[job.delivery_id,user])).rows[0].ok,false); // Stale worker cannot acknowledge.
await db.query("update line_notification_deliveries set lease_until=now()-interval '1 minute'");
const retried=(await claim(org))[0];assert.equal(retried.retry_key,job.retry_key);assert.notEqual(retried.claim_token,job.claim_token);
await db.query("select finish_line_notification($1,$2,false,'LINE_HTTP_429',null)",[retried.delivery_id,retried.claim_token]);
assert.equal((await claim(org)).length,0); // Backoff.
await db.query('update line_notification_deliveries set next_attempt_at=now()');
await db.query('update line_group_connections set enabled=false');assert.equal((await claim(org)).length,0);
await db.query('update line_group_connections set enabled=true');
const final=(await claim(org))[0];
await db.query('select finish_line_notification($1,$2,true,null,$3)',[final.delivery_id,final.claim_token,'request-1']);
assert.ok((await db.query('select delivered_at from notification_outbox')).rows[0].delivered_at);
assert.equal((await claim(org)).length,0);
for (const role of ['anon','authenticated']) {
 assert.equal((await db.query("select has_function_privilege($1,'claim_line_notifications(uuid,integer)','EXECUTE') as allowed",[role])).rows[0].allowed,false);
}
await db.exec('set role authenticated');assert.equal((await db.query('select * from line_notification_deliveries')).rows.length,0);
await db.exec('reset role');await db.close();
console.log('Thai messages, accepted retry responses, tenant isolation, atomic leases, stable retry keys, backoff, disabled groups and restricted access passed.');
