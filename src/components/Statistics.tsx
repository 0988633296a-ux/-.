"use client";
import { date, type Incident } from "@/lib/model";
import {
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  MapPin,
} from "lucide-react";
import { useState } from "react";
export default function Statistics({
  incidents,
  onOpen,
}: {
  incidents: Incident[];
  onOpen: (id: string) => void;
}) {
  const [period, setPeriod] = useState("เดือนนี้");
  const data = incidents.filter(
    (i) =>
      period === "ทั้งหมด" ||
      (period === "วันนี้"
        ? new Date(i.reportedAt).toDateString() === new Date().toDateString()
        : period === "เดือนนี้"
          ? i.reportedAt.slice(0, 7) === new Date().toISOString().slice(0, 7)
          : i.reportedAt.slice(0, 4) === String(new Date().getFullYear())),
  );
  const typeCounts = Object.entries(
    data.reduce<Record<string, number>>(
      (acc, i) => ({ ...acc, [i.type]: (acc[i.type] || 0) + 1 }),
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);
  const avg = (start: string, end: string) => {
    const values = data
      .map((i) => {
        const s =
          start === "รับแจ้ง"
            ? i.reportedAt
            : i.timeline.find((t) => t.to === start)?.at;
        const e = i.timeline.find((t) => t.to === end)?.at;
        return s && e ? (+new Date(e) - +new Date(s)) / 60000 : null;
      })
      .filter((v): v is number => v !== null && v >= 0);
    return values.length
      ? `${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)} นาที (${values.length} เหตุ)`
      : "ยังไม่มีข้อมูลเวลาเพียงพอ";
  };
  return (
    <>
      <div className="resource-toolbar">
        <h2>
          สถิติ
          {incidents.some((i) => i.demo) ? "จากข้อมูลตัวอย่าง" : "หน่วยงาน"}
        </h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="ช่วงเวลาสถิติ"
        >
          {["วันนี้", "เดือนนี้", "ปีนี้", "ทั้งหมด"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="stat-grid">
        {[
          {
            name: "เวลาตอบสนองเฉลี่ย",
            sub: "รับแจ้ง → ออกปฏิบัติการ",
            value: avg("รับแจ้ง", "ออกปฏิบัติการ"),
          },
          {
            name: "เวลาเดินทางเฉลี่ย",
            sub: "ออกปฏิบัติการ → ถึงเหตุ",
            value: avg("ออกปฏิบัติการ", "ถึงเหตุ"),
          },
          {
            name: "เวลาปฏิบัติการเฉลี่ย",
            sub: "ดำเนินการ → ควบคุมเหตุได้",
            value: avg("ดำเนินการ", "ควบคุมเหตุได้"),
          },
        ].map((s) => (
          <div className="card padded" key={s.name}>
            <Clock size={22} className="blue-text" />
            <h3>{s.name}</h3>
            <strong className="stat-value">{s.value}</strong>
            <small className="muted">{s.sub}</small>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="card padded">
          <h2>ประเภทเหตุที่พบบ่อย</h2>
          {typeCounts.length ? (
            typeCounts.map(([type, n]) => (
              <div className="bar-row" key={type}>
                <span>{type}</span>
                <div>
                  <i
                    style={{
                      width: `${(n / Math.max(...typeCounts.map((t) => t[1]))) * 100}%`,
                    }}
                  />
                </div>
                <b>{n}</b>
              </div>
            ))
          ) : (
            <Empty text="ไม่มีเหตุในช่วงเวลานี้" />
          )}
        </section>
        <section className="card padded">
          <h2>พื้นที่และช่วงเวลาเกิดเหตุ</h2>
          {Object.entries(
            data.reduce<Record<string, number>>(
              (a, i) => ({
                ...a,
                [i.area || "ไม่ระบุพื้นที่"]:
                  (a[i.area || "ไม่ระบุพื้นที่"] || 0) + 1,
              }),
              {},
            ),
          ).map(([area, n]) => (
            <div className="summary-row" key={area}>
              <span>
                <MapPin size={17} />
                {area}
              </span>
              <b>{n} เหตุ</b>
            </div>
          ))}
          {["00–05 น.", "06–11 น.", "12–17 น.", "18–23 น."].map((label, k) => (
            <div className="summary-row" key={label}>
              <span>
                <Clock size={16} />
                {label}
              </span>
              <b>
                {
                  data.filter(
                    (i) =>
                      Math.floor(new Date(i.reportedAt).getHours() / 6) === k,
                  ).length
                }{" "}
                เหตุ
              </b>
            </div>
          ))}
        </section>
      </div>
      <section className="card padded">
        <h2>รายงานเหตุที่เสร็จสิ้น</h2>
        {data
          .filter((i) => i.status === "เสร็จสิ้น")
          .map((i) => (
            <button
              className="notification-row"
              key={i.id}
              onClick={() => onOpen(i.id)}
            >
              <FileText size={22} />
              <div>
                <strong>{i.title}</strong>
                <small>
                  {i.number} · {date(i.reportedAt)}
                </small>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
        {!data.some((i) => i.status === "เสร็จสิ้น") && (
          <Empty text="ยังไม่มีเหตุเสร็จสิ้นในช่วงเวลานี้" />
        )}
      </section>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <ClipboardCheck size={30} />
      <p>{text}</p>
    </div>
  );
}
