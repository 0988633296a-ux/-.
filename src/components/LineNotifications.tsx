"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { client } from "@/lib/persistence";
import { date } from "@/lib/model";
type Group = { id: string; name: string; enabled: boolean; available: boolean };
type Delivery = { id: string; status: string; sent_at: string | null; last_error: string | null };
export default function LineNotifications({ live }: { live: boolean }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [state, setState] = useState("กำลังตรวจการเชื่อมต่อ LINE…");
  useEffect(() => {
    if (!live) return;
    let active = true;
    async function refresh() {
      try {
        if (!navigator.onLine) { if(active) setState("ออฟไลน์ — ตรวจสถานะ LINE อีกครั้งเมื่อออนไลน์"); return; }
        const db = client();
        if (!db) { if(active) setState("ยังไม่ได้เชื่อมฐานข้อมูลหน่วยงาน"); return; }
        const { data, error } = await db.from("line_group_connections").select("id,name,enabled,available").is("deleted_at", null);
        if (error) throw error;
        if (!active) return;
        const rows = (data || []) as Group[];
        setGroups(rows);
        if (!rows.length) { setDeliveries([]); setState("ผู้ดูแลหน่วยงานสามารถตรวจกลุ่ม LINE ที่เชื่อมได้"); return; }
        const result = await db.from("line_notification_deliveries").select("id,status,sent_at,last_error").in("connection_id", rows.map(g=>g.id)).order("created_at",{ascending:false}).limit(10);
        if (result.error) throw result.error;
        if (active) { setDeliveries(result.data || []); setState(""); }
      } catch { if(active) setState("ตรวจสถานะ LINE ไม่สำเร็จ — กำลังตรวจอีกครั้ง"); }
    }
    void refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { active=false; window.clearInterval(timer); };
  }, [live]);
  if (!live) return <div className="info-box"><Bell size={20}/><span>โหมดข้อมูลตัวอย่างไม่ส่งแจ้งเตือน LINE เข้าสู่ระบบหน่วยงานเพื่อใช้งานจริง</span></div>;
  const labels: Record<string,string> = { pending:"รอส่ง", processing:"กำลังส่ง", sent:"LINE รับข้อความแล้ว", failed:"ส่งไม่สำเร็จ", skipped:"ไม่ได้ส่ง" };
  return <div>
    <h3>แจ้งเตือนผ่าน LINE</h3>
    {state && <div className="info-box"><Bell size={20}/><span>{state}</span></div>}
    {groups.map(g=><div className="info-box" key={g.id}><Bell size={20}/><div><strong>{g.name} · {g.enabled&&g.available?"เปิดรับแจ้งเตือน":"ยังไม่เปิดรับแจ้งเตือน"}</strong><p>แจ้งเหตุใหม่และเหตุวิกฤต เมื่อข้อมูลบันทึกเข้าระบบแล้ว โดยทั่วไปภายในประมาณ 1 นาที</p></div></div>)}
    {deliveries.length>0 && <><h3>ผลการส่งล่าสุด</h3>{deliveries.map(d=><div className="summary-row" key={d.id}><span>{labels[d.status] || "กำลังตรวจสถานะ"}</span><small>{d.sent_at?date(d.sent_at):d.status==="failed"?"ให้ผู้ดูแลตรวจการเชื่อมต่อและโควตา LINE":"ระบบจะตรวจและส่งตามคิว"}</small></div>)}</>}
  </div>;
}
