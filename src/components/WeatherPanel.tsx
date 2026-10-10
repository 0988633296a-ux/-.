"use client";
import { useCallback, useEffect, useState } from "react";
import { CloudRain, RefreshCw, Wind } from "lucide-react";
import { defaultConnection } from "@/lib/supabase-config";
type Forecast = { time: string; rain: number | null; windSpeed: number | null; windDirection: number | null; temperature: number | null; condition: number | null };
type Weather = { status: "connected" | "stale" | "unavailable"; message: string | null; fetchedAt: string | null; checkedAt?: string; data: null | { source: string; kind: string; requestedLocation: { name: string; lat: number; lon: number }; modelLocation: { lat: number | null; lon: number | null }; forecasts: Forecast[] } };
const STORAGE = "drc-tmd-weather-real-v1";
const when = (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const number = (value: number | null) => value === null ? "ไม่มีข้อมูล" : value.toLocaleString("th-TH", { maximumFractionDigits: 1 });
const direction = (value: number | null) => value === null ? "" : ["เหนือ", "ตะวันออกเฉียงเหนือ", "ตะวันออก", "ตะวันออกเฉียงใต้", "ใต้", "ตะวันตกเฉียงใต้", "ตะวันตก", "ตะวันตกเฉียงเหนือ"][Math.round(value / 45) % 8];
function valid(value: any): value is Weather { return value && ["connected", "stale", "unavailable"].includes(value.status) && (!value.data || Array.isArray(value.data.forecasts)); }
export default function WeatherPanel({ compact = false }: { compact?: boolean }) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const refresh = useCallback(async () => {
    if (!navigator.onLine) { setOffline(true); return; }
    setOffline(false); setBusy(true);
    try {
      const response = await fetch(`${defaultConnection.url}/functions/v1/tmd-weather`, { headers: { apikey: defaultConnection.key }, signal: AbortSignal.timeout(25000), cache: "no-store" });
      if (!response.ok) throw new Error("เรียกข้อมูลพยากรณ์ไม่สำเร็จ");
      const value = await response.json();
      if (!valid(value)) throw new Error("ข้อมูลพยากรณ์ไม่สมบูรณ์");
      setWeather(previous => !value.data && previous?.data ? { ...previous, status: "stale", message: value.message } : value);
      if (value.data) { try { localStorage.setItem(STORAGE, JSON.stringify(value)); } catch {} }
    } catch {
      setWeather(previous => previous?.data ? { ...previous, status: "stale", message: "เชื่อมต่อไม่สำเร็จ แสดงข้อมูลที่เก็บไว้ล่าสุด" } : { status: "unavailable", message: "เชื่อมต่อข้อมูลกรมอุตุฯ ไม่สำเร็จ กรุณาลองใหม่", data: null, fetchedAt: null });
    } finally { setBusy(false); }
  }, []);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE) || "null"); if (valid(saved)) setWeather({ ...saved, status: "stale" }); } catch {}
    void refresh();
    const offline = () => setOffline(true);
    const online = () => void refresh();
    window.addEventListener("offline", offline); window.addEventListener("online", online);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15 * 60000);
    return () => { window.clearInterval(timer); window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, [refresh]);
  const forecasts = weather?.data?.forecasts || [];
  const next = forecasts.find(f => Date.parse(f.time) >= Date.now()) || forecasts[0];
  const fresh = weather?.status === "connected" && !offline && weather.fetchedAt && Date.now() - Date.parse(weather.fetchedAt) < 30 * 60000 && forecasts.some(f => Date.parse(f.time) >= Date.now());
  const label = offline ? "ออฟไลน์ · ข้อมูลที่เก็บไว้" : busy && !weather?.data ? "กำลังเชื่อมต่อกรมอุตุฯ" : fresh ? "เชื่อม API จริงแล้ว" : weather?.data ? "ข้อมูลเดิม · ยังไม่อัปเดต" : "ยังไม่มีข้อมูลจริง";
  const visibleRows = compact ? forecasts.slice(0, 3) : expanded ? forecasts : forecasts.slice(0, 6);
  return <section className="card padded weather-panel" aria-label="พยากรณ์อากาศกรมอุตุนิยมวิทยา">
    <div className="weather-heading"><h2><CloudRain size={23} /> พยากรณ์ฝนและลม</h2><button className="secondary" disabled={busy || offline} onClick={() => void refresh()} aria-label="อัปเดตพยากรณ์อากาศ"><RefreshCw size={17} className={busy ? "weather-spinning" : ""} />{busy ? "กำลังอัปเดต" : "อัปเดต"}</button></div>
    <p className="muted">ลำห้วยหลัว · สมเด็จ · กาฬสินธุ์</p>
    <span className={`badge ${fresh ? "green" : "neutral"}`}>{label}</span>
    <span className="badge neutral">{weather?.data ? "ข้อมูลพยากรณ์จริง · กรมอุตุนิยมวิทยา" : "แหล่งข้อมูล: กรมอุตุนิยมวิทยา"}</span>
    {weather?.message && <p className="weather-message" role="status">{weather.message}</p>}
    {!weather?.data && !busy && <p>ยังไม่แสดงค่าฝนหรือลมจนกว่าจะได้รับข้อมูลจริงจากกรมอุตุฯ</p>}
    {next && <>
      <p className="weather-period">พยากรณ์ช่วง {when(next.time)} น.</p>
      <div className="weather-metrics">
        <div><CloudRain size={22} /><span>ฝนในชั่วโมงนี้</span><strong>{number(next.rain)}{next.rain !== null && <small> มม.</small>}</strong></div>
        <div><Wind size={22} /><span>ความเร็วลมที่สูง 10 เมตร</span><strong>{number(next.windSpeed)}{next.windSpeed !== null && <small> ม./วินาที</small>}</strong>{next.windSpeed !== null && <small>ประมาณ {number(next.windSpeed * 3.6)} กม./ชม. · {direction(next.windDirection)}</small>}</div>
        {!compact && <div><span>อุณหภูมิ</span><strong>{number(next.temperature)}{next.temperature !== null && <small> °C</small>}</strong></div>}
      </div>
      <div className="weather-table-wrap"><table className="weather-table"><caption>พยากรณ์รายชั่วโมง · เวลาไทย</caption><thead><tr><th>เวลา</th><th>ฝน (มม.)</th><th>ลม (ม./วินาที)</th>{!compact && <th>อุณหภูมิ (°C)</th>}</tr></thead><tbody>{visibleRows.map(f => <tr key={f.time}><td>{when(f.time)}</td><td>{number(f.rain)}</td><td>{number(f.windSpeed)}</td>{!compact && <td>{number(f.temperature)}</td>}</tr>)}</tbody></table></div>
      {!compact && forecasts.length > 6 && <button className="secondary" onClick={() => setExpanded(!expanded)}>{expanded ? "ย่อพยากรณ์" : `ดูทั้งหมด ${forecasts.length} ชั่วโมง`}</button>}
    </>}
    {weather?.fetchedAt && <p className="muted">ดึงข้อมูลสำเร็จล่าสุด {when(weather.fetchedAt)} น.</p>}
    <small className="muted">ใช้พิกัดอ้างอิงพื้นที่ ไม่ใช่จุดเกิดเหตุ เป็นผลพยากรณ์แบบจำลอง ไม่ใช่ค่าฝนที่วัดหน้างานหรือประกาศเตือนภัย</small>
    <p><a href="https://data.tmd.go.th/nwpapi/doc/" target="_blank" rel="noopener noreferrer">แหล่งข้อมูลกรมอุตุนิยมวิทยา</a></p>
  </section>;
}
