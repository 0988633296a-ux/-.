export const location = { name: "ตำบลลำห้วยหลัว อำเภอสมเด็จ จังหวัดกาฬสินธุ์", lat: 16.6971878, lon: 103.7459312 };
function numeric(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
export function normalizeForecast(raw: any, now = Date.now()) {
  const rows = raw?.WeatherForecasts ?? raw?.WeatherForcasts ?? raw?.WeatherForecast;
  if (!Array.isArray(rows) || !rows.length) throw new Error("ไม่พบข้อมูลพยากรณ์จากกรมอุตุฯ");
  const row = rows[0];
  const forecasts = (Array.isArray(row.forecasts) ? row.forecasts : []).map((f: any) => ({
    time: typeof f.time === "string" ? f.time : "",
    rain: numeric(f.data?.rain, 0, 2000),
    windSpeed: numeric(f.data?.ws10m, 0, 200),
    windDirection: numeric(f.data?.wd10m, 0, 360),
    temperature: numeric(f.data?.tc, -90, 70),
    condition: numeric(f.data?.cond, 1, 12),
  })).filter((f: any) => Number.isFinite(Date.parse(f.time)) && Date.parse(f.time) >= now - 3600000)
    .sort((a: any, b: any) => Date.parse(a.time) - Date.parse(b.time));
  if (!forecasts.length || !forecasts.some((f: any) => f.rain !== null || f.windSpeed !== null)) throw new Error("ยังไม่มีพยากรณ์ฝนหรือลมที่ครอบคลุมเวลาปัจจุบัน");
  return { source: "กรมอุตุนิยมวิทยา", kind: "พยากรณ์รายชั่วโมง", requestedLocation: location,
    modelLocation: { lat: numeric(row.location?.lat, -90, 90), lon: numeric(row.location?.lon ?? row.location?.lng, -180, 180) }, forecasts };
}
