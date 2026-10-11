# เชื่อมกลุ่ม LINE เจ้าหน้าที่ ปภ.

ติดตั้ง Edge Function `line-webhook` ในโปรเจกต์ `zkmaubtpxiptbbqtazfr` แล้ว URL:

`https://zkmaubtpxiptbbqtazfr.supabase.co/functions/v1/line-webhook`

เก็บ `LINE_CHANNEL_SECRET` และ `LINE_CHANNEL_ACCESS_TOKEN` ใน Supabase Edge Function Secrets เท่านั้น ไม่เก็บในโค้ดหรือเว็บ วันที่ 11 ตุลาคม 2569 ตรวจ LINE Bot Info สำเร็จ บัญชี OA `peerapat` ผู้ดูแลยืนยันกลุ่มจริง **งาน ปภ.** เปิดส่งแล้ว ข้อความทดสอบผ่าน worker ส่งครั้งเดียว LINE รับ HTTP 200 พร้อม request ID ไม่สร้างเหตุปลอม

เครื่องมือตรวจชั่วคราว `drc-line-connection-check` ปิดแล้ว (410 และตรวจ JWT) ไม่ได้อ่านค่าคีย์ออกมานอก Supabase ไม่ได้ส่งข้อความใด

## ตั้งค่าฝั่ง LINE

1. ใส่ URL ข้างต้นใน Webhook URL ของช่อง แล้วกด Verify
2. เปิด Use webhook และเปิด Allow bot to join group chats
3. เพิ่มบัญชี OA เป็นเพื่อน แล้วเชิญเข้า **กลุ่มเจ้าหน้าที่ที่ต้องการรับแจ้งเหตุ**
4. พิมพ์ `เชื่อม ปภ.` ในกลุ่ม เพื่อให้ระบบระบุกลุ่มได้หากพลาด join event

Webhook รับเฉพาะคำขอ POST ที่ลายเซ็น `x-line-signature` ถูกต้อง ใช้ HMAC SHA256 บน raw bytes ก่อนแปลง JSON ตรวจด้วย Web Crypto ไม่บันทึกข้อความแชตทั่วไป และไม่ตอบข้อความกลับ

## การอนุมัติกลุ่มและสถานะการส่ง

join หรือข้อความขอเชื่อมจะสร้างกลุ่ม **รอยืนยัน** ใน `line_group_connections` โดย `enabled=false` ไม่ได้ให้กลุ่มใดรับข้อมูลเหตุโดยอัตโนมัติ ผู้ดูแลหน่วยงานต้องยืนยันกลุ่มเป้าหมายก่อนเปิดส่งจริง `leave` จะปิดส่งและระบุว่า OA ไม่อยู่ในกลุ่มแล้ว

ตัวส่ง `line-notify` เปิดแล้ว Supabase Cron `drc-line-notify` เรียกทุกนาที ส่งคิว `new_incident` / `critical_incident` ที่เกิดหลังกลุ่มได้รับอนุมัติ ส่งเลขเหตุ ประเภท ระดับ สถานที่ เวลารับแจ้ง และแผนที่ OpenStreetMap ไม่ส่งชื่อ/เบอร์ผู้แจ้งหรือข้อมูลผู้บาดเจ็บ โหมดข้อมูลตัวอย่างในเครื่องไม่ส่ง LINE ข้อมูลออฟไลน์ส่งหลังซิงก์เข้าฐานข้อมูลจริง การเตือนรถ/อุปกรณ์/ครบตรวจยังเป็นการเตือนในเว็บ ไม่ได้เปิดส่ง LINE ในรุ่นนี้

หน้าเพิ่มเติม → การแจ้งเตือน แสดงกลุ่มและผลส่งจริงสำหรับผู้ดูแลหน่วยงาน ดึงข้อมูลใหม่ทุกนาที ผล “LINE รับข้อความแล้ว” ไม่ได้หมายความว่าสมาชิกอ่านแล้ว

`line_notification_deliveries` เก็บผลต่อกลุ่ม พร้อม attempts/sent_at/error/request_id เก็บ snapshot ข้อมูลข้อความ, lease 5 นาที, claim token ป้องกัน worker พร้อมกัน, `X-Line-Retry-Key` คงเดิมทั้ง retry/timeout/process ล่ม HTTP 409 ถือว่ารับแล้วเฉพาะมี `x-line-accepted-request-id` retry สูงสุด 8 ครั้ง ภายใน 23 ชั่วโมง มี backoff สูงสุด 1 ชั่วโมง HTTP 400/403 หยุด retry ต้องให้ผู้ดูแลตรวจสาเหตุ

ติดตั้ง `supabase/line-notifications.sql` แล้ว deploy `supabase/functions/line-notify` ก่อนรัน `supabase/line-notification-schedule.sql` worker ใช้ custom auth `x-line-worker-key` สุ่มฝั่งฐานข้อมูลและเก็บเข้ารหัสใน Vault ไม่มีคีย์ฝังใน cron command RPC `authorize_line_worker` เรียกได้เฉพาะ service_role และคืน boolean ผ่าน private SECURITY DEFINER helper ที่อ่านเฉพาะ Vault key นี้ ไม่ให้ public/anon/authenticated เข้าถึง ทั้ง queue RPC เป็น SECURITY INVOKER และ service-only

การอนุมัติกลุ่มครั้งนี้ผู้ดูแลยืนยันในแชตตั้งค่า บันทึก approved_by/approved_at และ audit log พร้อมแหล่งที่มา ไม่เปิดให้ผู้ใช้ทั่วไปเปลี่ยนกลุ่มเอง ติดตามโควตา LINE ใน OA Manager และ failed ในฐานข้อมูล ห้ามใช้ broadcast แทนกลุ่มที่อนุมัติ

## ฐานข้อมูลและการตรวจสอบ

ใช้ `supabase/line-webhook.sql` ติดตั้งตารางกลุ่มและใบรับเหตุการณ์พร้อม RLS ผู้ใช้ทั่วไปหรือ anon ไม่แก้ข้อมูลนี้ กลุ่มอ่านได้เฉพาะ administrator/center_lead ของหน่วยงาน ฟังก์ชันบันทึกเรียกได้เฉพาะ service role พร้อม deduplication ใน transaction และ audit log การเปลี่ยนข้อมูลกลุ่ม ไม่ส่งรหัสกลุ่มกลับไปในคำตอบ Webhook

ผูก OA กับ UUID หน่วยงานลำห้วยหลัวฝั่งเซิร์ฟเวอร์ ไม่รับ organization_id จากข้อความ

`node tests/line-webhook.mjs` ตรวจลายเซ็น body เปลี่ยน secret ผิด และการรับเฉพาะเหตุการณ์กลุ่ม `node tests/line-database.mjs` ตรวจ event ซ้ำ ค่าเริ่มต้นไม่เปิดส่ง leave/rejoin และสิทธิ์ฐานข้อมูล `node tests/line-notifications.mjs` ตรวจข้อความไทย/ไม่ส่งข้อมูลส่วนบุคคล/409/atomic lease/stale claim/tenant isolation/retry/backoff/กลุ่ม disabled/RLS คำขอ remote ที่ไม่มีลายเซ็นหรือ worker key ตอบ 401 ตามที่ต้องการ Webhook จริงรับ join/connect แล้ว และ worker จริงส่งข้อความทดสอบสำเร็จพร้อม request ID

Security advisors หลังติดตั้งไม่พบ warning ใหม่ ตาราง receipts/weather cache เป็น service-only โดยตั้งใจ Existing guarded SECURITY DEFINER incident RPC warnings และ leaked password protection warning ยังคงเดิม ดู docs/07-live-configuration.md
