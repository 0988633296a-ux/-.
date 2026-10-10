import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { normalizeForecast } from '../supabase/functions/tmd-weather/forecast.ts';
const now = Date.parse('2026-10-08T07:00:00+07:00');
const fixture = { WeatherForecasts: [{ location: { lat: 16.7, lon: 103.7 }, forecasts: [
 {time:'2026-10-08T07:00:00+07:00',data:{rain:0,ws10m:0,wd10m:0,tc:28}},
 {time:'2026-10-08T08:00:00+07:00',data:{rain:null,ws10m:3,wd10m:90,tc:29}},
 {time:'2025-01-01T08:00:00+07:00',data:{rain:10,ws10m:3}},
]}]};
const data = normalizeForecast(fixture, now);
assert.equal(data.forecasts.length,2);
assert.equal(data.forecasts[0].rain,0);
assert.equal(data.forecasts[0].windSpeed,0);
assert.equal(data.forecasts[1].rain,null);
assert.throws(()=>normalizeForecast({},now));
assert.throws(()=>normalizeForecast(fixture,now+2*86400000),/เวลาปัจจุบัน/);
const db = new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
await db.exec(readFileSync('supabase/tmd-weather.sql','utf8'));
await db.exec('set role service_role;');
assert.equal((await db.query('select public.claim_tmd_weather_refresh() as claimed')).rows[0].claimed,true);
assert.equal((await db.query('select public.claim_tmd_weather_refresh() as claimed')).rows[0].claimed,false);
await db.exec("update public.external_weather_cache set next_attempt_at=now()-interval '1 minute';");
assert.equal((await db.query('select public.claim_tmd_weather_refresh() as claimed')).rows[0].claimed,true);
await db.exec('reset role; set role anon;');
await assert.rejects(()=>db.query('select * from public.external_weather_cache'),/permission denied/);
await assert.rejects(()=>db.query('select public.claim_tmd_weather_refresh()'),/permission denied/);
await db.exec('reset role; set role authenticated;');
await assert.rejects(()=>db.query('update public.external_weather_cache set payload=null'),/permission denied/);
await db.close();
console.log('PASS: real zero vs missing values, reject expired/invalid forecasts, service-only cache, shared refresh claim and retry');
