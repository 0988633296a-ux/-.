"use client";
import { useEffect, useRef, useState } from "react";
import { client } from "@/lib/persistence";

export default function ActivateAccount() {
  const initialized = useRef(false);
  const [token, setToken] = useState("");
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const value = new URLSearchParams(window.location.hash.slice(1)).get("invite");
    if (value) {
      setToken(value);
      // Keep the one-time credential out of browser history and request URLs.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  if (!token) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#10213ee8", display: "grid", placeItems: "center", padding: 20, overflowY: "auto" }}>
      <section className="card padded" role="dialog" aria-modal="true" aria-labelledby="activation-title" style={{ maxWidth: 480, width: "100%" }}>
        <h2 id="activation-title">เปิดใช้งานบัญชี ปภ. ลำห้วยหลัว</h2>
        {done ? <>
          <p>ตั้งรหัสผ่านแล้ว คุณเข้าสู่ระบบเรียบร้อย</p>
          <p>ไปที่ เพิ่มเติม → ตั้งค่า แล้วกด “เปิดข้อมูลหน่วยงานจริง”</p>
          <button className="primary" onClick={() => window.location.assign("/")}>เริ่มใช้งาน</button>
        </> : <form className="incident-form" onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          if (password.length < 12) { setError("ใช้รหัสผ่านอย่างน้อย 12 ตัวอักษร"); return; }
          if (password !== confirm) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
          const supabase = client();
          if (!supabase) { setError("ยังไม่ได้ตั้งค่าการเชื่อมต่อ"); return; }
          setBusy(true);
          try {
            if (!verified) {
              const result = await supabase.auth.verifyOtp({ token_hash: token, type: "invite" });
              if (result.error) throw new Error("ลิงก์เปิดใช้งานหมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่จากผู้ดูแลโปรเจกต์");
              setVerified(true);
            }
            const result = await supabase.auth.updateUser({ password });
            if (result.error) throw new Error("ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง หรือตรวจสอบข้อกำหนดรหัสผ่านของโปรเจกต์");
            setPassword(""); setConfirm(""); setDone(true);
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "เปิดใช้งานไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง");
          } finally { setBusy(false); }
        }}>
          <p>ตั้งรหัสผ่านของคุณเองเพื่อเริ่มใช้ข้อมูลจริง ลิงก์นี้ใช้ได้ครั้งเดียว</p>
          <label>รหัสผ่านใหม่<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <label>ยืนยันรหัสผ่าน<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
          {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
          <button className="primary" type="submit" disabled={busy}>{busy ? "กำลังเปิดใช้งาน…" : "ตั้งรหัสผ่านและเปิดใช้งาน"}</button>
        </form>}
      </section>
    </div>
  );
}
