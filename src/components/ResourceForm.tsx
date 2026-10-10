"use client";
import { uid, type Resource } from "@/lib/model";
import { Save } from "lucide-react";
import { useState } from "react";
import Dialog from "./Dialog";
export default function ResourceForm({
  kind,
  resource: r,
  staff,
  onClose,
  onSave,
}: {
  kind: string;
  resource?: Resource;
  staff: Resource[];
  onClose: () => void;
  onSave: (r: Resource) => void;
}) {
  const [error, setError] = useState("");
  return (
    <Dialog title={`${r ? "แก้ไข" : "เพิ่ม"}${kind}`} onClose={onClose}>
      <form
        className="incident-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const val = (n: string) => String(f.get(n) || "");
          const num = (n: string) => Number(f.get(n) || 0);
          if (
            kind === "อุปกรณ์" &&
            num("ready") + num("broken") > num("total")
          ) {
            setError("จำนวนพร้อมและชำรุดต้องไม่เกินจำนวนทั้งหมด");
            return;
          }
          onSave({
            ...r,
            id: r?.id || uid(),
            name: val("name"),
            type: val("type"),
            status: val("status"),
            phone: val("phone"),
            unit: val("unit"),
            skills: val("skills")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            plate: val("plate"),
            water: num("water"),
            fuel: num("fuel"),
            mileage: num("mileage"),
            driver: val("driver"),
            total: num("total"),
            ready: num("ready"),
            broken: num("broken"),
            location: val("location"),
            checked: val("checked")
              ? new Date(val("checked")).toISOString()
              : undefined,
            notes: val("notes"),
          });
        }}
      >
        <label>
          {kind === "กำลังพล" ? "ชื่อ–นามสกุล" : "ชื่อเรียก"} *
          <input name="name" required defaultValue={r?.name} />
        </label>
        <div className="form-grid">
          <label>
            {kind === "กำลังพล" ? "ตำแหน่ง" : "ประเภท"} *
            <input name="type" required defaultValue={r?.type} />
          </label>
          <label>
            สถานะ
            <select name="status" defaultValue={r?.status || "พร้อม"}>
              {(kind === "กำลังพล"
                ? ["พร้อม", "ปฏิบัติงาน", "ลา", "ไม่พร้อม"]
                : kind === "ยานพาหนะ"
                  ? ["พร้อม", "ปฏิบัติงาน", "ซ่อม", "ไม่พร้อม"]
                  : ["พร้อม", "ไม่พร้อม"]
              ).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        {kind === "กำลังพล" && (
          <>
            <div className="form-grid">
              <label>
                โทรศัพท์
                <input name="phone" type="tel" defaultValue={r?.phone} />
              </label>
              <label>
                หน่วย
                <input name="unit" defaultValue={r?.unit} />
              </label>
            </div>
            <label>
              ทักษะ (คั่นด้วยเครื่องหมาย ,)
              <input
                name="skills"
                defaultValue={r?.skills?.join(", ")}
                placeholder="ดับเพลิง, กู้ภัย, กู้ชีพ, เรือ, ขับรถ, SAR"
              />
            </label>
          </>
        )}
        {kind === "ยานพาหนะ" && (
          <>
            <label>
              ทะเบียน
              <input name="plate" defaultValue={r?.plate} />
            </label>
            <div className="form-grid">
              <label>
                ความจุน้ำ (ลิตร)
                <input
                  name="water"
                  type="number"
                  min="0"
                  defaultValue={r?.water || 0}
                />
              </label>
              <label>
                เชื้อเพลิง (%)
                <input
                  name="fuel"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={r?.fuel || 0}
                />
              </label>
              <label>
                เลขไมล์
                <input
                  name="mileage"
                  type="number"
                  min="0"
                  defaultValue={r?.mileage || 0}
                />
              </label>
              <label>
                คนขับ
                <select name="driver" defaultValue={r?.driver || ""}>
                  <option value="">ยังไม่ระบุ</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
        {kind === "อุปกรณ์" && (
          <>
            <div className="form-grid three">
              {[
                { n: "total", label: "ทั้งหมด" },
                { n: "ready", label: "พร้อม" },
                { n: "broken", label: "ชำรุด" },
              ].map((x) => (
                <label key={x.n}>
                  {x.label}
                  <input
                    name={x.n}
                    type="number"
                    min="0"
                    required
                    defaultValue={r?.[x.n as "total" | "ready" | "broken"] || 0}
                  />
                </label>
              ))}
            </div>
            <label>
              ที่เก็บ
              <input name="location" defaultValue={r?.location} />
            </label>
            <label>
              วันที่ตรวจล่าสุด
              <input
                name="checked"
                type="date"
                defaultValue={r?.checked?.slice(0, 10)}
              />
            </label>
          </>
        )}
        <label>
          หมายเหตุ
          <textarea name="notes" defaultValue={r?.notes} />
        </label>
        {error && (
          <p className="red-text" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button type="button" className="secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" className="primary">
            <Save size={18} />
            บันทึก
          </button>
        </div>
      </form>
    </Dialog>
  );
}
