import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { location, normalizeForecast } from "./forecast.ts";

// This function returns only public weather forecasts for a fixed location.
// The publishable API key authenticates the app, not an agency user.
function keys(name: string): string[] {
  try { return Object.values(JSON.parse(Deno.env.get(name) || "{}")) as string[]; } catch { return []; }
}
const allowedOrigins = new Set(["https://disaster-response-center-th.animedreamer.chatgpt.site", "http://localhost:3000", "http://localhost:3001"]);
// Older upstream servers may terminate HTTP/2 negotiation; TLS verification stays enabled.
const upstreamClient = Deno.createHttpClient({ http1: true, http2: false });
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = { "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://disaster-response-center-th.animedreamer.chatgpt.site", "Access-Control-Allow-Headers": "apikey, authorization, x-client-info, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store" };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
  if (origin && !allowedOrigins.has(origin)) return reply({ error: "ไม่อนุญาตให้เรียกจากเว็บไซต์นี้" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "GET") return reply({ error: "รองรับ GET เท่านั้น" }, 405);
  const validKeys = [...keys("SUPABASE_PUBLISHABLE_KEYS"), Deno.env.get("SUPABASE_ANON_KEY")].filter(Boolean);
  if (!validKeys.includes(req.headers.get("apikey") || "")) return reply({ error: "ไม่อนุญาตให้เรียกข้อมูล" }, 401);
  const adminKey = keys("SUPABASE_SECRET_KEYS")[0] || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!adminKey) return reply({ status: "unavailable", message: "ระบบเชื่อมต่อข้อมูลยังไม่พร้อม", data: null });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: cached, error: readError } = await db.from("external_weather_cache").select("*").eq("id", "tmd_lamhuailua").maybeSingle();
    if (readError) throw new Error("อ่านข้อมูลพยากรณ์ที่เก็บไว้ไม่สำเร็จ");
    const result = (row: any, message?: string) => {
      const future = row?.payload?.forecasts?.some((f: any) => Date.parse(f.time) >= Date.now());
      const fresh = future && !message && !row?.last_error && Date.now() - Date.parse(row.fetched_at) < 30 * 60000;
      return reply({ status: row?.payload ? fresh ? "connected" : "stale" : "unavailable", message: message || row?.last_error || null, fetchedAt: row?.fetched_at || null, checkedAt: new Date().toISOString(), data: row?.payload || null });
    };
    if (cached && Date.parse(cached.next_attempt_at) > Date.now()) return result(cached);
    const token = (Deno.env.get("TMD_API_TOKEN") || Deno.env.get("กรมอุตุ token"))?.trim();
    if (!token) return result(cached, "รอเชื่อม API จริง: ยังไม่พบ TMD_API_TOKEN ใน Supabase Secrets");
    const { data: claimed, error: claimError } = await db.rpc("claim_tmd_weather_refresh");
    if (claimError) throw new Error("ระบบพักการเรียกกรมอุตุฯ ชั่วคราว");
    if (!claimed) return result(cached, cached?.payload ? undefined : "กำลังดึงข้อมูลกรมอุตุฯ กรุณาลองอีกครั้ง");
    try {
      const url = new URL("https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly/at");
      url.search = new URLSearchParams({ lat: String(location.lat), lon: String(location.lon), fields: "rain,ws10m,wd10m,tc,cond", duration: "24" }).toString();
      const upstream = await fetch(url, { client: upstreamClient, headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      if (!upstream.ok) {
        const message = upstream.status === 401 || upstream.status === 403 ? "กรมอุตุฯ ไม่ยอมรับ Token กรุณาตรวจสอบ TMD_API_TOKEN" : upstream.status === 429 ? "กรมอุตุฯ จำกัดจำนวนการเรียกข้อมูล ระบบจะลองใหม่ภายหลัง" : `กรมอุตุฯ ตอบกลับผิดพลาด (HTTP ${upstream.status})`;
        throw new Error(message);
      }
      const data = normalizeForecast(await upstream.json());
      const fetchedAt = new Date().toISOString();
      const { error } = await db.from("external_weather_cache").update({ payload: data, fetched_at: fetchedAt, last_error: null }).eq("id", "tmd_lamhuailua");
      if (error) throw new Error("เก็บข้อมูลพยากรณ์ล่าสุดไม่สำเร็จ");
      return result({ payload: data, fetched_at: fetchedAt });
    } catch (error) {
      // Never include upstream response bodies, request headers, or token values.
      const diagnostic = error instanceof Error ? /UnknownIssuer|unknown issuer/i.test(error.message) ? "tls_unknown_issuer" : /expired/i.test(error.message) ? "tls_expired" : /certificate|tls|ssl/i.test(error.message) ? "tls" : /header|bytestring|character/i.test(error.message) ? "header" : /dns|resolve/i.test(error.message) ? "dns" : error.name : "unknown";
      console.warn("tmd-upstream-diagnostic", diagnostic);
      if (diagnostic.startsWith("tls") && error instanceof Error) console.warn("tmd-tls-detail", error.message.replaceAll(token, "[redacted]").replace(/https?:\/\/[^\s)]+/g, "[endpoint]").slice(0, 500));
      const message = diagnostic.startsWith("tls") ? "เชื่อมต่อ HTTPS กับกรมอุตุฯ ไม่สำเร็จ ระบบจะลองใหม่ภายหลัง" : error instanceof Error && /^(กรมอุตุฯ|ไม่พบข้อมูล|ยังไม่มีพยากรณ์|เก็บข้อมูล)/.test(error.message) ? error.message : error instanceof Error && error.name === "TimeoutError" ? "กรมอุตุฯ ตอบกลับช้าเกินกำหนด ระบบจะลองใหม่ภายหลัง" : error instanceof SyntaxError ? "กรมอุตุฯ ไม่ได้ส่งข้อมูล JSON ที่อ่านได้ กรุณาลองใหม่ภายหลัง" : "เชื่อมเครือข่ายกรมอุตุฯ ไม่สำเร็จ กรุณาลองใหม่ภายหลัง";
      await db.from("external_weather_cache").update({ last_error: message, next_attempt_at: new Date(Date.now() + 60000).toISOString() }).eq("id", "tmd_lamhuailua");
      return result(cached, message);
    }
  } catch {
    return reply({ status: "unavailable", message: "ระบบเชื่อมต่อข้อมูลพยากรณ์ยังไม่พร้อม กรุณาลองใหม่ภายหลัง", data: null });
  }
});
