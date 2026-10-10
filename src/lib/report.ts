import type { Incident, Store } from "./model";
import { date, time } from "./model";
import { getPhoto } from "./persistence";
const escapeHTML = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function printReport(
  i: Incident,
  store: Store,
  notify: (s: string) => void,
) {
  const w = window.open("", "_blank");
  if (!w) {
    notify("กรุณาอนุญาตหน้าต่างใหม่เพื่อดูรายงาน");
    return;
  }
  const photoHTML = await Promise.all(
    i.photos.map(async (p) => {
      const b = await getPhoto(p.id);
      let url = p.url;
      if (b)
        url = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(b);
        });
      return `<figure>${url ? `<img src="${escapeHTML(url)}"/>` : "<p>ไม่พบไฟล์ภาพในอุปกรณ์นี้</p>"}<figcaption>${escapeHTML(p.phase)} · ${escapeHTML(p.description)}<br>${date(p.at)} ${time(p.at)} · ${escapeHTML(p.actor)}<br>GPS: ${escapeHTML(p.lat ?? "ไม่ระบุ")}, ${escapeHTML(p.lng ?? "ไม่ระบุ")}</figcaption></figure>`;
    }),
  );
  w.document.write(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงาน ${escapeHTML(i.number)}</title><base href="${location.origin}/"><style>@font-face{font-family:Noto Sans Thai;font-weight:400;src:url(/fonts/noto-thai-400.ttf)}@font-face{font-family:Noto Sans Thai;font-weight:600;src:url(/fonts/noto-thai-600.ttf)}</style><style>body{font-family:'Noto Sans Thai',sans-serif;color:#172b4d;max-width:850px;margin:30px auto;padding:20px;line-height:1.7}h1{font-size:24px}h2{font-size:18px;border-bottom:1px solid #ddd;padding-bottom:8px;margin-top:26px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left;font-size:14px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px}p{white-space:pre-wrap}.demo{color:#bb5b1c}.photos{display:grid;grid-template-columns:1fr 1fr;gap:15px}figure{margin:0;break-inside:avoid}img{width:100%;max-height:300px;object-fit:contain}figcaption{font-size:12px}button{padding:12px 20px;background:#172b4d;color:white;border:0;border-radius:6px;font:inherit;cursor:pointer}@media print{body{margin:0;padding:0}.toolbar{display:none}@page{size:A4;margin:15mm}thead{display:table-header-group}tr{break-inside:avoid}} </style></head><body><div class="toolbar"><button onclick="document.fonts.ready.then(()=>window.print())">พิมพ์ / บันทึกเป็น PDF</button></div>${i.demo ? '<p class="demo">ข้อมูลตัวอย่าง — ไม่ใช่รายงานเหตุจริง</p>' : ""}<h1>รายงานผลการปฏิบัติงานสาธารณภัย</h1><p>${escapeHTML(i.number)} · ${escapeHTML(i.status)}</p><div class="meta"><div>ประเภท: ${escapeHTML(i.type)}<br>ระดับ: ${escapeHTML(i.level)}</div><div>รับแจ้ง: ${date(i.reportedAt)} ${time(i.reportedAt)} น.<br>ช่องทาง: ${escapeHTML(i.channel)}</div></div><p><b>สถานที่:</b> ${escapeHTML(i.address)}<br><b>GPS:</b> ${i.lat}, ${i.lng}<br><b>ผู้แจ้ง:</b> ${escapeHTML(i.reporter)} ${escapeHTML(i.phone)}</p><h2>รายละเอียดเหตุ</h2><p>${escapeHTML(i.description)}</p><p>ผู้บาดเจ็บ ${i.injured} คน · ผู้เสียชีวิต ${i.dead} คน · คนติดอยู่ ${i.trapped} คน<br>ความเสี่ยง: ${escapeHTML(i.risks.join(", ") || "ไม่ระบุ")}</p><h2>ลำดับเหตุการณ์</h2><table><thead><tr><th>วันเวลา</th><th>สถานะเดิม → ใหม่</th><th>ผู้บันทึก</th></tr></thead><tbody>${i.timeline.map((t) => `<tr><td>${date(t.at)} ${time(t.at)}</td><td>${escapeHTML(t.from)} → ${escapeHTML(t.to)}</td><td>${escapeHTML(t.actor)}</td></tr>`).join("")}</tbody></table><h2>กำลังพล ยานพาหนะ และอุปกรณ์</h2><p>เจ้าหน้าที่: ${escapeHTML(i.staff.map((id) => store.staff.find((s) => s.id === id)?.name || id).join(", ") || "ไม่มีการบันทึก")}<br>ยานพาหนะ: ${escapeHTML(
      i.vehicles
        .map((id) => {
          const r = store.vehicles.find((v) => v.id === id);
          return r ? `${r.name} (${r.plate})` : id;
        })
        .join(", ") || "ไม่มีการบันทึก",
    )}<br>อุปกรณ์: ${escapeHTML(
      Object.entries(i.equipment)
        .map(
          ([id, n]) =>
            `${store.equipment.find((e) => e.id === id)?.name || id} ${n} ชิ้น`,
        )
        .join(", ") || "ไม่มีการบันทึก",
    )}</p><h2>Checklist ก่อนออกปฏิบัติงาน</h2><p>${escapeHTML(i.checks.join(" · ") || "ยังไม่มีการตรวจ")}</p><h2>การดำเนินงานและผลลัพธ์</h2><p>${escapeHTML(i.result || "ยังไม่บันทึก")}</p><h2>ความเสียหาย</h2><p>${escapeHTML(i.damage || "ไม่ระบุ")}</p><h2>ปัญหาและข้อเสนอแนะ</h2><p>${escapeHTML(i.problems || "ไม่ระบุ")}</p><h2>ภาพหน้างาน</h2><div class="photos">${photoHTML.join("") || "<p>ไม่มีภาพแนบ</p>"}</div><h2>ผู้รับผิดชอบ</h2><p>ผู้บันทึก: ${escapeHTML(i.timeline[0]?.actor)}<br>ผู้ควบคุมเหตุ: ${escapeHTML(i.commander || "ยังไม่ระบุ")}<br>สร้างรายงาน: ${date(new Date().toISOString())} ${time(new Date().toISOString())}</p></body></html>`,
  );
  w.document.close();
}
