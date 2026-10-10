"use client";
import { useEffect, useState } from "react";
import { client } from "@/lib/persistence";

export default function ActivateAccount() {
  const [recovery, setRecovery] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [token, setToken] = useState("");
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const value = hash.get("invite");
    if (value) {
      setToken(value);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    const requested = new URLSearchParams(window.location.search).get("auth") === "recovery" || hash.get("type") === "recovery";
    if (!requested) return;
    setRecovery(true);
    if (hash.has("error")) {
      setError("ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่");
      window.history.replaceState(null, "", window.location.pathname + "?auth=recovery");
      return;
    }
    const c = client();
    if (!c) { setError("ยังไม่ได้ตั้งค่าการเชื่อมต่อ"); return; }
    let active = true;
    const subscription = c.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        sessionStorage.setItem("drc-recovery-user", session.user.id);
        if (active) setRecoveryReady(true);
      }
    });
    c.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session && (hash.get("type") === "recovery" || sessionStorage.getItem("drc-recovery-user") === data.session.user.id)) {
        const verifiedUser = await c.auth.getUser();
        if (!active) return;
        if (verifiedUser.data.user && !verifiedUser.error) {
          sessionStorage.setItem("drc-recovery-user", verifiedUser.data.user.id);
          setRecoveryReady(true);
        } else setError("ตรวจสอบลิงก์ไม่สำเร็จ กรุณาเปิดลิงก์จากอีเมลอีกครั้ง");
      } else setError("กรุณาเปิดลิงก์ตั้งรหัสผ่านจากอีเมล หรือขอลิงก์ใหม่จากเมนูลืมรหัสผ่าน");
    });
    return () => { active = false; subscription.data.subscription.unsubscribe(); };
  }, []);
  if (!token && !recovery) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#10213ee8", display: "grid", placeItems: "center", padding: 20, overflowY: "auto" }}>
      <section className="card padded" role="dialog" aria-modal="true" aria-labelledby="activation-title" style={{ maxWidth: 480, width: "100%" }}>
        <h2 id="activation-title">{recovery ? "ตั้งรหัสผ่านใหม่" : "เปิดใช้งานบัญชี ปภ. ลำห้วยหลัว"}</h2>
        {done ? <>
          <p>ตั้งรหัสผ่านแล้ว คุณเข้าสู่ระบบเรียบร้อย</p>
          <p>กด “เข้าสู่ระบบ” บนหน้าหลัก เพื่อเปิดข้อมูลหน่วยงานจริง</p>
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
            if (recovery && !recoveryReady) { setError("กรุณาเปิดลิงก์ตั้งรหัสผ่านจากอีเมลก่อน"); return; }
            if (!recovery && !verified) {
              const result = await supabase.auth.verifyOtp({ token_hash: token, type: "invite" });
              if (result.error) throw new Error("ลิงก์เปิดใช้งานหมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่จากผู้ดูแลโปรเจกต์");
              setVerified(true);
            }
            const result = await supabase.auth.updateUser({ password });
            if (result.error) throw new Error("ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง หรือตรวจสอบข้อกำหนดรหัสผ่านของโปรเจกต์");
            sessionStorage.removeItem("drc-recovery-user");
            setPassword(""); setConfirm(""); setDone(true);
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "เปิดใช้งานไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง");
          } finally { setBusy(false); }
        }}>
          <p>{recovery ? "ตั้งรหัสผ่านใหม่อย่างน้อย 12 ตัวอักษร" : "ตั้งรหัสผ่านของคุณเองเพื่อเริ่มใช้ข้อมูลจริง ลิงก์นี้ใช้ได้ครั้งเดียว"}</p>
          <label>รหัสผ่านใหม่<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <label>ยืนยันรหัสผ่าน<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
          {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
          <button className="primary" type="submit" disabled={busy || (recovery && !recoveryReady)}>{busy ? "กำลังดำเนินการ…" : recovery ? "บันทึกรหัสผ่านใหม่" : "ตั้งรหัสผ่านและเปิดใช้งาน"}</button>
          {recovery && <button className="secondary" type="button" onClick={() => window.location.assign("/")}>กลับหน้าหลัก</button>}
        </form>}
      </section>
    </div>
  );
}
