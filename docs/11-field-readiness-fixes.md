# แก้ไขความพร้อมภาคสนาม — 13 ตุลาคม 2569

แก้ finding 1–7 ในรายงานตรวจ Superpowers (/workspace/disaster-response-review-2026-10-13.md):

- can_work_incident จำกัด field_staff ให้เป็นเจ้าหน้าที่ที่ยังได้รับมอบหมาย และ staff ไม่ถูก soft-delete อ่านประวัติเหตุเดิมได้ แต่ถอนแล้วเขียนไม่ได้ ใช้ field-access-fix.sql อัปเกรดฐานข้อมูลเดิมโดยเก็บ ACL
- เปิด/รีโหลดขณะออฟไลน์คืนข้อมูลหน่วยงานจาก cache ของบัญชีและโปรเจกต์ที่ตรงกับ cached Supabase session ที่ยังไม่หมดอายุ คิวคำสั่งเดิมยังอยู่ ข้อมูล offline อาจเก่าและต้องยืนยันสิทธิ์ใหม่กับเซิร์ฟเวอร์ก่อนซิงก์
- หลังอัปเดตต้องเปิดเว็บออนไลน์และเข้าสู่ระบบหนึ่งครั้งเพื่อสร้าง cache/account profile รูปแบบใหม่ ถ้าไม่มี cache หรือ session หมดอายุ ต้องออนไลน์เพื่อยืนยันบัญชี ข้อมูลเดิมไม่ถูกลบ
- cache/profile/outbox รุ่นใหม่แยกตาม project origin และ user ID ร่างแยก live/demo, project, organization และ user ห้ามเปลี่ยนการเชื่อมต่อขณะอยู่ในข้อมูลจริง async completion ตรวจ epoch/owner/scope ก่อนนำผลกลับ และ queue ใช้ client เดิมตลอดการซิงก์
- คิวรุ่นเก่าที่ไม่ทราบโปรเจกต์เจ้าของยังเก็บครบในเครื่อง ไม่ replay อัตโนมัติ หน้าข้อมูลจริงแสดงข้อความและปุ่มสำรองเพื่อให้ผู้ดูแลตรวจสอบก่อนนำเข้า ร่างรุ่นเก่าที่ไม่ทราบเจ้าของไม่ถูกโหลดเข้าสู่บัญชีใหม่โดยอัตโนมัติ
- ภาพหน้างานหลังรอ GPS รวมเข้ากับ state ปัจจุบัน ไม่ทับ Checklist ใหม่ เปลี่ยนบัญชีหรือปิดเหตุระหว่างรอแล้วจะไม่ผูกภาพกับเหตุผิด
- ภาพของร่างเก็บ Blob เข้า IndexedDB ตั้งแต่เลือก และเก็บ photo metadata ใน scoped draft กู้คืนจำนวน/thumbnail หลังปิดหรือ reload ได้ กำลังเขียนหรือเขียนล้มเหลวป้องกันปิดฟอร์ม พร้อมแสดงสถานะ/ให้ลองอีกครั้ง
- ร่างกู้คืนแสดงข้อความและวันเวลาร่าง พร้อมปุ่มใช้เวลาปัจจุบัน ไม่แก้เวลาประวัติย้อนหลังเอง ผล GPS จากฟอร์มที่ปิดแล้วไม่ทับร่างใหม่
- ตรวจ JPEG/PNG/WebP/HEIC และขนาดไม่เกิน 15 MB ก่อนเข้าคิว รูปแบบอื่นแจ้งให้เลือกใหม่ ตรงกับ bucket ปัจจุบัน

## หลักฐาน

พบ regression ที่ fail ก่อนแก้: released field writes, live offline startup, delayed GPS photo/checklist overwrite, draft photo/time recovery และ connection replacement ระหว่าง live

เพิ่ม tests/field-access.mjs, tests/live-offline.mjs, tests/photo-race.mjs, tests/incident-drafts.mjs (รวม browser integration เมื่อกำหนด DRC_TEST_URL) ทดสอบทั้ง schema ใหม่และ patch ด้วย field-access.mjs --patch

ชุดทดสอบเดิม 10 ชุดและ regression 4 ชุดผ่าน รวม workflow, photos/PDF ในเครื่อง, mock Auth, cached PWA reload และ LINE queue โดยไม่สร้างเหตุ production หรือส่งข้อความเข้ากลุ่ม ระบุว่าทดสอบ Auth ด้วย mock transport มิใช่ทดสอบรหัสผ่านผู้ใช้จริง Build และ TypeScript ผ่าน

ผู้ตรวจอิสระตรวจซ้ำ ไม่พบ Important finding ที่ยังค้างในชุดแก้ไข ฐานข้อมูลจริงนิยาม helper ใหม่มี released_at is null และ s.deleted_at is null, anon execute=false, authenticated execute=true, public tables RLS ยังเปิดทุกตาราง Security Advisor ไม่มี warning ใหม่ warnings RPC guarded เดิมและ leaked password protection เดิมยังคงอยู่

## ขอบเขตที่ยังต้องทดสอบภาคสนาม

การใช้พร้อมกันหลายอุปกรณ์กับบัญชีจริง การเดินทางสัญญาณหลุดจริง และการพิมพ์ภาพบนมือถือหลายรุ่น ยังควรทดสอบแบบนำร่อง LINE รุ่นนี้ยังส่งเหตุใหม่/วิกฤต ยังไม่เพิ่มการส่งยกเลิกหรือปิดเหตุในชุด bugfix นี้
