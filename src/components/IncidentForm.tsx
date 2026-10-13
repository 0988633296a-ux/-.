"use client";
import { levels, types, uid, type Incident, type Photo } from "@/lib/model";
import { getPhoto, putPhoto } from "@/lib/persistence";
import {
  INCIDENT_PHOTO_ACCEPT,
  incidentDraftKey,
  persistDraftPhotos,
  readIncidentDraft,
  validateIncidentPhoto,
  writeIncidentDraft,
  type DraftPhoto,
} from "@/lib/incident-drafts";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ExternalLink,
  LocateFixed,
  Plus,
  Save,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Dialog from "./Dialog";
export default function IncidentForm({
  onClose,
  onSave,
  actor,
  notify,
  draftScope,
  live = false,
}: {
  onClose: () => void;
  onSave: (i: Incident) => boolean;
  actor: string;
  draftScope?: string;
  live?: boolean;
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
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const photosRef = useRef<DraftPhoto[]>([]);
  const draftRef = useRef(draft);
  const initialDraft = useRef(draft);
  const pendingRef = useRef(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [storageError, setStorageError] = useState("");
  const [recoveredAt, setRecoveredAt] = useState("");
  const [previews, setPreviews] = useState<
    { id: string; url: string; name: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const generationRef = useRef(0);
  const draftKey = incidentDraftKey(draftScope, live);
  useEffect(() => {
    generationRef.current += 1;
    pendingRef.current = false;
    busyRef.current = false;
    setGpsBusy(false);
    setPhotoBusy(false);
    setBusy(false);
    draftRef.current = initialDraft.current;
    photosRef.current = [];
    setDraft(initialDraft.current);
    setPhotos([]);
    setRecoveredAt("");
    setStorageError("");
    setFailedFiles([]);
    try {
      const saved = readIncidentDraft<typeof draft>(localStorage, draftKey);
      if (saved) {
        const next = { ...initialDraft.current, ...saved.draft };
        draftRef.current = next;
        setDraft(next);
        photosRef.current = saved.photos;
        setPhotos(saved.photos);
        setRecoveredAt(saved.savedAt);
      }
    } catch {
      setStorageError("อ่านร่างที่บันทึกไว้ไม่สำเร็จ ร่างเดิมยังอยู่ในเครื่อง");
    }
    return () => {
      generationRef.current += 1;
    };
  }, [draftKey]);
  useEffect(() => {
    let disposed = false;
    const urls: string[] = [];
    void Promise.all(
      photos.map(async (photo) => {
        const blob = await getPhoto(photo.id);
        if (!blob)
          throw Error("ไม่พบภาพในร่าง กรุณาตรวจสอบพื้นที่จัดเก็บในเครื่อง");
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return { id: photo.id, url, name: photo.name };
      }),
    )
      .then((next) => {
        if (!disposed) setPreviews(next);
        else urls.forEach((url) => URL.revokeObjectURL(url));
      })
      .catch((err) => {
        if (!disposed)
          setStorageError(
            err instanceof Error ? err.message : "อ่านภาพในร่างไม่สำเร็จ",
          );
      });
    return () => {
      disposed = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);
  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (pendingRef.current || failedFiles.length > 0 || storageError) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [failedFiles.length, storageError]);
  const persist = (next = draftRef.current, nextPhotos = photosRef.current) => {
    try {
      writeIncidentDraft(localStorage, draftKey, next, nextPhotos);
      setStorageError("");
      return true;
    } catch {
      setStorageError("เก็บร่างไม่สำเร็จ กรุณาลองอีกครั้งก่อนปิด");
      notify("พื้นที่จัดเก็บร่างไม่เพียงพอ ร่างยังอยู่ในหน้าต่างนี้");
      return false;
    }
  };
  const field = (key: keyof typeof draft, value: any) => {
    const next = { ...draftRef.current, [key]: value };
    draftRef.current = next;
    setDraft(next);
    persist(next);
  };
  const selectPhotos = async (files: File[]) => {
    if (pendingRef.current || busyRef.current) return;
    const invalid = files.map(validateIncidentPhoto).find(Boolean);
    if (invalid) {
      notify(invalid);
      return;
    }
    const generation = generationRef.current;
    pendingRef.current = true;
    setPhotoBusy(true);
    setFailedFiles(files);
    try {
      const saved = await persistDraftPhotos(files, putPhoto, uid);
      if (generation !== generationRef.current) return;
      const next = [...photosRef.current, ...saved];
      photosRef.current = next;
      setPhotos(next);
      setFailedFiles([]);
      persist(draftRef.current, next);
    } catch (err) {
      if (generation !== generationRef.current) return;
      const message = err instanceof Error ? err.message : "เก็บภาพไม่สำเร็จ";
      setStorageError(`${message} กรุณาลองเก็บภาพอีกครั้งก่อนปิด`);
      notify(message);
    } finally {
      if (generation === generationRef.current) {
        pendingRef.current = false;
        setPhotoBusy(false);
      }
    }
  };
  const close = () => {
    if (pendingRef.current || busyRef.current) {
      notify("กรุณารอให้บันทึกเสร็จก่อนปิด");
      return;
    }
    if (failedFiles.length) {
      notify("กรุณาลองเก็บภาพอีกครั้งก่อนปิด");
      return;
    }
    if (persist()) {
      generationRef.current += 1;
      onClose();
    }
  };
  const locate = () => {
    if (!navigator.geolocation) {
      notify("อุปกรณ์ไม่รองรับตำแหน่ง GPS");
      return;
    }
    const generation = generationRef.current;
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (generation !== generationRef.current) return;
        const next = {
          ...draftRef.current,
          lat: p.coords.latitude,
          lng: p.coords.longitude,
        };
        draftRef.current = next;
        setDraft(next);
        persist(next);
        setGpsBusy(false);
        notify("บันทึกตำแหน่งปัจจุบันแล้ว");
      },
      () => {
        if (generation !== generationRef.current) return;
        setGpsBusy(false);
        notify("อ่าน GPS ไม่สำเร็จ กรุณาอนุญาตตำแหน่งหรือกรอกพิกัดเอง");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return (
    <Dialog
      title="รับแจ้งเหตุสาธารณภัย"
      subtitle={live ? "สร้างเหตุใหม่" : "สร้างเหตุใหม่ · ข้อมูลตัวอย่าง"}
      onClose={close}
    >
      <div className="draft-note">
        <Save size={16} />
        ร่างข้อความบันทึกอัตโนมัติในเครื่อง
      </div>
      {recoveredAt && (
        <div className="draft-note">
          กู้คืนร่างที่บันทึกไว้ ·{" "}
          {new Date(recoveredAt).toLocaleString("th-TH")}
          <button
            className="text-button"
            type="button"
            onClick={() =>
              field(
                "reportedAt",
                new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 16),
              )
            }
          >
            ใช้เวลาปัจจุบัน
          </button>
        </div>
      )}
      {storageError && (
        <div className="draft-note" role="alert">
          {storageError}
        </div>
      )}
      <form
        className="incident-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busyRef.current || pendingRef.current) return;
          if (failedFiles.length) {
            notify("กรุณาลองเก็บภาพอีกครั้งก่อนบันทึกเหตุ");
            return;
          }
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
          const generation = generationRef.current;
          busyRef.current = true;
          setBusy(true);
          try {
            const id = uid();
            const incidentPhotos: Photo[] = [];
            for (const photo of photosRef.current) {
              const blob = await getPhoto(photo.id);
              if (generation !== generationRef.current) return;
              if (!blob)
                throw Error(
                  "ไม่พบภาพในร่าง ยังไม่บันทึกเหตุ กรุณาตรวจสอบพื้นที่จัดเก็บ",
                );
              incidentPhotos.push({
                id: photo.id,
                phase: "ก่อนดำเนินการ",
                url: "",
                at: photo.at,
                actor,
                lat,
                lng,
                description: photo.name,
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
              photos: incidentPhotos,
              result: "",
              damage: "",
              problems: "",
              commander: "",
              version: 1,
              demo: !live,
            };
            if (onSave(i)) {
              generationRef.current += 1;
              if (draftKey) localStorage.removeItem(draftKey);
            }
          } catch (err) {
            if (generation !== generationRef.current) return;
            notify(
              err instanceof Error
                ? err.message
                : "บันทึกไม่สำเร็จ ร่างยังอยู่ในเครื่อง",
            );
          } finally {
            if (generation === generationRef.current) {
              busyRef.current = false;
              setBusy(false);
            }
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
              {photos.length
                ? `${photos.length} ภาพที่เก็บในร่าง`
                : "ถ่ายภาพหรืออัปโหลดจากมือถือ"}
            </small>
          </span>
          <input
            type="file"
            multiple
            accept={INCIDENT_PHOTO_ACCEPT}
            disabled={photoBusy || busy || failedFiles.length > 0}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              void selectPhotos(files);
            }}
          />
        </label>
        {photoBusy && <p role="status">กำลังเก็บภาพในร่าง…</p>}
        {failedFiles.length > 0 && !photoBusy && (
          <button
            type="button"
            className="secondary"
            onClick={() => void selectPhotos(failedFiles)}
          >
            ลองเก็บภาพอีกครั้ง ({failedFiles.length} ภาพ)
          </button>
        )}
        {previews.length > 0 && (
          <div className="gps-line">
            {previews.map((photo) => (
              <img
                key={photo.id}
                src={photo.url}
                alt={photo.name}
                width={72}
                height={72}
                style={{ objectFit: "cover" }}
              />
            ))}
          </div>
        )}
        <div className="form-footer">
          <button
            type="button"
            className="secondary"
            onClick={close}
            disabled={photoBusy || busy}
          >
            เก็บร่าง / ปิด
          </button>
          <button
            className="primary"
            type="submit"
            disabled={busy || photoBusy || failedFiles.length > 0}
          >
            <Plus size={19} />
            {busy ? "กำลังบันทึก…" : "บันทึกรับแจ้งเหตุ"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
