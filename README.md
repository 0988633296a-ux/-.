# Disaster Response Center — ระบบบริหารจัดการเหตุสาธารณภัย

เว็บแอปภาษาไทย Mobile First สร้างด้วย Next.js 15, React 19, TypeScript, Tailwind 4, Supabase และ Leaflet/OpenStreetMap

## เริ่มพัฒนา

```sh
npm ci
npm run dev
npm run typecheck
npm run build
node tests/database.mjs
node tests/browser.mjs
```

`next build` ส่งออกเว็บใน `out/` สำหรับ static hosting ส่วนข้อมูลจริงใช้ Supabase โดยตรงผ่าน Auth/RLS/RPC ไม่ต้องฝัง service_role ในเว็บ

## เอกสารก่อนพัฒนา

1. docs/01-information-architecture.md
2. docs/02-user-flow.md
3. docs/03-database-relationships.md
4. docs/04-wireframes.md
5. docs/05-design-system.md

## เปิดข้อมูลหน่วยงานจริง

1. สร้าง Supabase project และรัน `supabase/schema.sql` ใน SQL Editor ของฐานข้อมูลใหม่ (migration นี้ออกแบบให้รันครั้งเดียว)
2. สร้างบัญชีเจ้าหน้าที่ผ่าน Supabase Auth กำหนด redirect URL ให้ตรงกับ domain ที่ deploy
3. ผู้ดูแลฐานข้อมูลสร้าง organizations แล้วเพิ่ม public.users ด้วย id จาก auth.users, organization_id และ role (administrator / center_lead / dispatcher / field_staff / report_viewer)
4. เชื่อม staff.user_id กับ users.id สำหรับเจ้าหน้าที่ภาคสนาม เพื่อจำกัดการอ่านและทำงานเฉพาะเหตุที่ได้รับมอบหมาย
5. ในเว็บ: เพิ่มเติม → การตั้งค่า → กรอก Project URL และ publishable/anon key → บันทึก → เข้าสู่ระบบ → เปิดข้อมูลหน่วยงานจริง
6. เพิ่มกำลังพล รถ และอุปกรณ์จริงก่อนใช้งาน ข้อมูลตัวอย่างจะไม่ถูกส่งเข้าฐานข้อมูลจริง

ตัวอย่างการ provision (แทน UUID ด้วยค่าจริง; ทำใน SQL Editor โดยผู้ดูแล):

```sql
insert into public.organizations(name) values ('ศูนย์ ปภ. ของหน่วยงาน') returning id;
insert into public.users(id,organization_id,name,role)
values ('AUTH_USER_UUID','ORGANIZATION_UUID','ชื่อผู้ดูแล','administrator');
```

การเปลี่ยนบทบาทบัญชีอื่นใช้ `set_user_role` โดย administrator เท่านั้น ปุ่มเลือกบทบาทในโหมดตัวอย่างไม่ใช่การเปลี่ยนสิทธิ์บนเซิร์ฟเวอร์

## ข้อมูลและการซิงก์

ข้อมูลตัวอย่าง: localStorage แยก namespace; ภาพ: IndexedDB; ข้อมูลจริงที่รอส่ง: queue แยกตาม auth user UUID

คำสั่งจริงส่งผ่าน transactional RPC และ operation UUID ป้องกันซ้ำ การเปลี่ยนสถานะใช้ expected_version; ข้อมูลที่ขัดแย้งหยุดคิวและแจ้ง “รอตรวจสอบ” ไม่เขียนทับอัตโนมัติ การกู้ข้อขัดแย้งสำรองคำสั่งเป็น JSON ก่อนรับข้อมูลล่าสุดจากศูนย์

ภาพ upload เข้าถัง private `incident-photos` และใช้ signed URL การเปลี่ยนสถานะทั้งหมดใช้เวลา/ผู้กระทำจากเซิร์ฟเวอร์ เก็บ audit append-only และคืนทรัพยากรใน transaction เมื่อปิด/ยกเลิกเหตุ

PWA caches shell, assets และฟอนต์ไทยในเครื่อง; แผนที่ใหม่ต้องใช้อินเทอร์เน็ต และข้อมูลแผนที่ OSM ไม่มี offline tile pack ภาพที่แนบเข้ารายงานถูกอ่านจาก IndexedDB ก่อน signed URL

การปิดเหตุสร้าง reports.snapshot ในฐานข้อมูล รายงานหน้าพิมพ์โหลดฟอนต์ไทยจากเว็บเองเพื่อรองรับ offline และบันทึกเป็น PDF ผ่าน browser print

## ขอบเขตการส่งมอบ

MVP: Dashboard, รับแจ้ง/GPS/draft, จัดกำลัง/รถ/อุปกรณ์, Checklist, one-tap status, Timeline, ภาพสามช่วง, ปิด/ยกเลิกและคืนทรัพยากร, รายงาน Print/PDF/Share, ค้นหา, ทรัพยากร, สถิติ, audit, Supabase Auth/RLS/RPC, คิวซิงก์ และ PWA

Phase 2: การจัดการ template Checklist ผ่าน UI, การจัดการจุดสำคัญและพื้นที่เสี่ยงเพิ่มเติม, กราฟสถิติแยกวัน/เดือน/ปีและ export, การตรวจตามรอบและแจ้งเตือนเหตุค้างนานด้วย scheduled worker, ตำแหน่งสดของทีม/รถ, ซิงก์ใน background ของระบบปฏิบัติการเมื่อแอปปิด

Phase 3: เชื่อม API จริงกรมอุตุนิยมวิทยา Radar ThaiWater GISTDA Hotspot ระบบเตือนภัย และ LINE; เชื่อมระบบหน่วยงานและปรับ workflow ตาม SOP

โมดูล API เหล่านี้ระบุ “รอเชื่อม API จริง” ไม่มีข้อมูล API ปลอม

## การตรวจสอบ

- PostgreSQL-compatible PGlite: schema, RPC full lifecycle, guard Checklist/ทีม, idempotency, version conflicts, resource release, report snapshot, audit, role guard, soft delete
- Playwright: desktop/mobile, GPS, full lifecycle, photos, PDF, reload persistence, navigation
- ยังไม่มี Supabase ของหน่วยงานใน session: ยังไม่ได้ทดสอบ live Supabase Auth/Storage/network หรือ load/concurrency ในโครงสร้างหน่วยงานจริง ต้องทดสอบกับ staging project ก่อนใช้งานภาคสนามจริง
