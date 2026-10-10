"use client";
import { levels, types, uid, type Incident, type Photo } from "@/lib/model";
import { putPhoto } from "@/lib/persistence";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ExternalLink,
  LocateFixed,
  Plus,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import Dialog from "./Dialog";
export default function IncidentForm({
  onClose,
  onSave,
  actor,
  notify,
}: {
  onClose: () => void;
  onSave: (i: Incident) => boolean;
  actor: string;
  notify: (s: string) => void;
}) {
  const [draft, setDraft] = useState<{
    type: string;
    level: string;
    channel: string;
    reportedAt: string;
    address: string;
    lat: string | number;
    lng: string | number;
    title: string;
    description: string;
    reporter: string;
    phone: string;
    injured: string | number;
    dead: string | number;
    trapped: string | number;
    risks: string[];
    area: string;
  }>({
    type: "ต้นไม้ล้ม",
    level: "ทั่วไป",
    channel: "โทรศัพท์",
    reportedAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
    address: "",
    lat: "",
    lng: "",
    title: "",
    description: "",
    reporter: "",
    phone: "",
    injured: 0,
    dead: 0,
    trapped: 0,
    risks: [],
    area: "",
  });
  const [gpsBusy, setGpsBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      const d = localStorage.getItem("drc-incident-draft");
      if (d) setDraft(JSON.parse(d));
    } catch {}
  }, []);
  const field = (key: keyof typeof draft, value: any) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    try {
      localStorage.setItem("drc-incident-draft", JSON.stringify(next));
    } catch {
      notify("พื้นที่จัดเก็บร่างไม่เพียงพอ");
    }
  };
  const locate = () => {
    if (!navigator.geolocation) {
      notify("อุปกรณ์ไม่รองรับตำแหน่ง GPS");
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = {
          ...draft,
          lat: p.coords.latitude,
          lng: p.coords.longitude,
        };
        setDraft(next);
        localStorage.setItem("drc-incident-draft", JSON.stringify(next));
        setGpsBusy(false);
        notify("บันทึกตำแหน่งปัจจุบันแล้ว");
      },
      () => {
        setGpsBusy(false);
        notify("อ่าน GPS ไม่สำเร็จ กรุณาอนุญาตตำแหน่งหรือกรอกพิกัดเอง");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return (
    <Dialog
      title="รับแจ้งเหตุสาธารณภัย"
      subtitle="สร้างเหตุใหม่ · ข้อมูลตัวอย่าง"
      onClose={onClose}
    >
      <div className="draft-note">
        <Save size={16} />
        ร่างข้อความบันทึกอัตโนมัติในเครื่อง
      </div>
      <form
        className="incident-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const lat = Number(draft.lat),
            lng = Number(draft.lng);
          if (
            !draft.lat ||
            !draft.lng ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            Math.abs(lat) > 90 ||
            Math.abs(lng) > 180
          ) {
            notify("กรุณาระบุพิกัด GPS ที่ถูกต้อง");
            return;
          }
          setBusy(true);
          try {
            const id = uid();
            const photos: Photo[] = [];
            for (const file of files) {
              if (file.size > 15 * 1024 * 1024)
                throw Error("ภาพต้องมีขนาดไม่เกิน 15 MB");
              const photoId = uid();
              await putPhoto(photoId, file);
              photos.push({
                id: photoId,
                phase: "ก่อนดำเนินการ",
                url: "",
                at: new Date().toISOString(),
                actor,
                lat,
                lng,
                description: file.name,
              });
            }
            const i: Incident = {
              ...draft,
              type: draft.type,
              address: draft.address,
              area: draft.area,
              level: draft.level,
              reporter: draft.reporter,
              phone: draft.phone,
              channel: draft.channel,
              description: draft.description,
              risks: draft.risks,
              id,
              number: `DRC-${new Date().getFullYear() + 543}-${new Date().toLocaleDateString("en-GB").replaceAll("/", "")}-${id.slice(0, 5).toUpperCase()}`,
              lat,
              lng,
              title: draft.title || draft.type,
              reportedAt: new Date(draft.reportedAt).toISOString(),
              injured: Number(draft.injured) || 0,
              dead: Number(draft.dead) || 0,
              trapped: Number(draft.trapped) || 0,
              status: "รับแจ้ง",
              staff: [],
              vehicles: [],
              equipment: {},
              checks: [],
              timeline: [
                {
                  id: uid(),
                  at: new Date().toISOString(),
                  actor,
                  from: "",
                  to: "รับแจ้ง",
                },
              ],
              photos,
              result: "",
              damage: "",
              problems: "",
              commander: "",
              version: 1,
              demo: true,
            };
            if (onSave(i)) localStorage.removeItem("drc-incident-draft");
          } catch (err) {
            notify(
              err instanceof Error
                ? err.message
                : "บันทึกไม่สำเร็จ ร่างยังอยู่ในเครื่อง",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            ประเภทเหตุ *
            <select
              value={draft.type}
              onChange={(e) => field("type", e.target.value)}
            >
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            ระดับเหตุ *
            <select
              value={draft.level}
              onChange={(e) => field("level", e.target.value)}
            >
              {levels.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            วันเวลารับแจ้ง *
            <input
              type="datetime-local"
              required
              value={draft.reportedAt}
              onChange={(e) => field("reportedAt", e.target.value)}
            />
          </label>
          <label>
            ช่องทางรับแจ้ง
            <select
              value={draft.channel}
              onChange={(e) => field("channel", e.target.value)}
            >
              {[
                "โทรศัพท์",
                "วิทยุ",
                "เจ้าหน้าที่",
                "ประชาชน",
                "ระบบแจ้งเตือน",
                "อื่น ๆ",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          ชื่อเหตุ
          <input
            value={draft.title}
            onChange={(e) => field("title", e.target.value)}
            placeholder="หากไม่ระบุ จะใช้ชื่อประเภทเหตุ"
          />
        </label>
        <label>
          สถานที่ / รายละเอียดจุดเกิดเหตุ *
          <textarea
            required
            value={draft.address}
            onChange={(e) => field("address", e.target.value)}
            rows={2}
            placeholder="ถนน หมู่บ้าน จุดสังเกต หรือทางเข้าพื้นที่"
          />
        </label>
        <div className="gps-line">
          <button
            className="secondary"
            type="button"
            disabled={gpsBusy}
            onClick={locate}
          >
            <LocateFixed size={18} />
            {gpsBusy ? "กำลังอ่านตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน"}
          </button>
          {draft.lat && draft.lng && (
            <a
              className="text-button"
              href={`https://www.openstreetmap.org/?mlat=${draft.lat}&mlon=${draft.lng}#map=17/${draft.lat}/${draft.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              เปิดแผนที่ <ExternalLink size={15} />
            </a>
          )}
        </div>
        <div className="form-grid">
          <label>
            ละติจูด *
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              required
              value={draft.lat}
              onChange={(e) => field("lat", e.target.value)}
              placeholder="16.697188"
            />
          </label>
          <label>
            ลองจิจูด *
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              required
              value={draft.lng}
              onChange={(e) => field("lng", e.target.value)}
              placeholder="103.745931"
            />
          </label>
        </div>
        <label>
          พื้นที่ / หมู่บ้าน / ตำบล
          <input
            value={draft.area}
            onChange={(e) => field("area", e.target.value)}
            placeholder="เช่น หมู่บ้าน ตำบลลำห้วยหลัว อำเภอสมเด็จ"
          />
        </label>
        <label>
          รายละเอียดเหตุ
          <textarea
            rows={3}
            value={draft.description}
            onChange={(e) => field("description", e.target.value)}
            placeholder="สถานการณ์ที่พบ และความช่วยเหลือที่ต้องการ"
          />
        </label>
        <div className="form-grid">
          <label>
            ชื่อผู้แจ้ง
            <input
              value={draft.reporter}
              onChange={(e) => field("reporter", e.target.value)}
            />
          </label>
          <label>
            เบอร์โทรศัพท์
            <input
              type="tel"
              value={draft.phone}
              onChange={(e) => field("phone", e.target.value)}
            />
          </label>
        </div>
        <details className="additional">
          <summary>
            <AlertTriangle size={17} />
            ผู้ได้รับผลกระทบและความเสี่ยง <ChevronDown size={18} />
          </summary>
          <div className="form-grid three">
            {[
              { k: "injured", label: "ผู้บาดเจ็บ" },
              { k: "dead", label: "ผู้เสียชีวิต" },
              { k: "trapped", label: "คนติดอยู่" },
            ].map((x) => (
              <label key={x.k}>
                {x.label}
                <input
                  type="number"
                  min="0"
                  value={draft[x.k as "injured" | "dead" | "trapped"]}
                  onChange={(e) =>
                    field(x.k as "injured" | "dead" | "trapped", e.target.value)
                  }
                />
              </label>
            ))}
          </div>
          <div className="risk-options">
            {["ไฟฟ้า", "สารอันตราย", "ความเสี่ยงลุกลาม"].map((s) => (
              <label key={s}>
                <input
                  type="checkbox"
                  checked={draft.risks.includes(s)}
                  onChange={(e) =>
                    field(
                      "risks",
                      e.target.checked
                        ? [...draft.risks, s]
                        : draft.risks.filter((r: string) => r !== s),
                    )
                  }
                />
                {s}
              </label>
            ))}
          </div>
        </details>
        <label className="upload-small">
          <Camera size={22} />
          <span>
            แนบภาพจุดเกิดเหตุ{" "}
            <small>
              {files.length
                ? `${files.length} ภาพที่เลือก`
                : "ถ่ายภาพหรืออัปโหลดจากมือถือ"}
            </small>
          </span>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
        </label>
        <div className="form-footer">
          <button type="button" className="secondary" onClick={onClose}>
            เก็บร่าง / ปิด
          </button>
          <button className="primary" type="submit" disabled={busy}>
            <Plus size={19} />
            {busy ? "กำลังบันทึก…" : "บันทึกรับแจ้งเหตุ"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
