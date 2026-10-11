# เชื่อมกลุ่ม LINE เจ้าหน้าที่ ปภ.

ติดตั้ง Edge Function `line-webhook` ในโปรเจกต์ `zkmaubtpxiptbbqtazfr` แล้ว URL:

`https://zkmaubtpxiptbbqtazfr.supabase.co/functions/v1/line-webhook`

เก็บ `LINE_CHANNEL_SECRET` และ `LINE_CHANNEL_ACCESS_TOKEN` ใน Supabase Edge Function Secrets เท่านั้น ไม่เก็บในโค้ดหรือเว็บ เมื่อวันที่ 11 ตุลาคม 2569 ตรวจพบทั้งสองชื่อ แต่การเรียก LINE Bot Info ด้วย access token ตอบ HTTP 401 ทั้งก่อนและหลังตัดช่องว่าง ค่าจึงยังใช้ส่งข้อความไม่ได้ ต้องแทนด้วย Channel access token ของ Messaging API ช่องที่ต้องการ ไม่ใช่ Channel ID หรือ Channel secret

เครื่องมือตรวจชั่วคราว `drc-line-connection-check` ปิดแล้ว (410 และตรวจ JWT) ไม่ได้อ่านค่าคีย์ออกมานอก Supabase ไม่ได้ส่งข้อความใด

## ตั้งค่าฝั่ง LINE

1. ใส่ URL ข้างต้นใน Webhook URL ของช่อง แล้วกด Verify
2. เปิด Use webhook และเปิด Allow bot to join group chats
3. เพิ่มบัญชี OA เป็นเพื่อน แล้วเชิญเข้า **กลุ่มเจ้าหน้าที่ที่ต้องการรับแจ้งเหตุ**
4. พิมพ์ `เชื่อม ปภ.` ในกลุ่ม เพื่อให้ระบบระบุกลุ่มได้หากพลาด join event

Webhook รับเฉพาะคำขอ POST ที่ลายเซ็น `x-line-signature` ถูกต้อง ใช้ HMAC SHA256 บน raw bytes ก่อนแปลง JSON ตรวจด้วย Web Crypto ไม่บันทึกข้อความแชตทั่วไป และไม่ตอบข้อความกลับ

## การอนุมัติกลุ่มและสถานะการส่ง

join หรือข้อความขอเชื่อมจะสร้างกลุ่ม **รอยืนยัน** ใน `line_group_connections` โดย `enabled=false` ไม่ได้ให้กลุ่มใดรับข้อมูลเหตุโดยอัตโนมัติ ผู้ดูแลหน่วยงานต้องยืนยันกลุ่มเป้าหมายก่อนเปิดส่งจริง `leave` จะปิดส่งและระบุว่า OA ไม่อยู่ในกลุ่มแล้ว

การเชื่อมครั้งนี้เตรียมส่วนรับ Webhook/ระบุกลุ่มเท่านั้น ตัวส่งข้อความอัตโนมัติยังไม่ได้เปิดใช้งาน ต้องแก้ Token ให้ LINE ยอมรับ ผูกและยืนยันกลุ่ม แล้วทำ worker ส่งจาก `notification_outbox` พร้อมป้องกันส่งซ้ำ/ตรวจผลส่ง ไม่ถือว่าการพบกลุ่มหรือ Verify สำเร็จหมายถึงส่งแจ้งเตือนจริงแล้ว

## ฐานข้อมูลและการตรวจสอบ

ใช้ `supabase/line-webhook.sql` ติดตั้งตารางกลุ่มและใบรับเหตุการณ์พร้อม RLS ผู้ใช้ทั่วไปหรือ anon ไม่แก้ข้อมูลนี้ กลุ่มอ่านได้เฉพาะ administrator/center_lead ของหน่วยงาน ฟังก์ชันบันทึกเรียกได้เฉพาะ service role พร้อม deduplication ใน transaction และ audit log การเปลี่ยนข้อมูลกลุ่ม ไม่ส่งรหัสกลุ่มกลับไปในคำตอบ Webhook

ผูก OA กับ UUID หน่วยงานลำห้วยหลัวฝั่งเซิร์ฟเวอร์ ไม่รับ organization_id จากข้อความ

`node tests/line-webhook.mjs` ตรวจลายเซ็น body เปลี่ยน secret ผิด และการรับเฉพาะเหตุการณ์กลุ่ม `node tests/line-database.mjs` ตรวจ event ซ้ำ ค่าเริ่มต้นไม่เปิดส่ง leave/rejoin และสิทธิ์ฐานข้อมูล คำขอ remote ที่ไม่มีลายเซ็นตอบ 401 ตามที่ต้องการ การ Verify จาก LINE จริงยังรอผู้ดูแลใส่ URL
