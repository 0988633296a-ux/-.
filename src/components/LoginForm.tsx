"use client";
import { useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { client } from "@/lib/persistence";

export function authMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "invalid_credentials") return "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง";
  if (code === "email_not_confirmed") return "กรุณาเปิดใช้งานบัญชีจากลิงก์ในอีเมลก่อนเข้าสู่ระบบ";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
  return "เชื่อมต่อระบบบัญชีไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง";
}

export default function LoginForm({ onSuccess }: { onSuccess: () => Promise<boolean> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  return <form className="incident-form login-form" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setError(""); setMessage("");
    if (!navigator.onLine) { setError("การเข้าสู่ระบบต้องใช้อินเทอร์เน็ต ข้อมูลที่บันทึกไว้ในเครื่องยังอยู่ครบ"); return; }
    const c = client();
    if (!c) { setError("ยังไม่ได้ตั้งค่าการเชื่อมต่อ กรุณาติดต่อผู้ดูแล"); return; }
    setBusy(true);
    try {
      if (reset) {
        const result = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/?auth=recovery" });
        if (result.error) throw result.error;
        setMessage("หากอีเมลนี้มีบัญชีในระบบ คุณจะได้รับลิงก์ตั้งรหัสผ่านใหม่ กรุณาตรวจกล่องจดหมายและจดหมายขยะ");
      } else {
        const result = await c.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        setPassword("");
        if (!await onSuccess()) setError("เข้าสู่ระบบบัญชีแล้ว แต่เปิดข้อมูลหน่วยงานไม่ได้ กรุณาตรวจอินเทอร์เน็ตหรือให้ผู้ดูแลตรวจสิทธิ์บัญชี");
      }
    } catch (failure) { setError(authMessage(failure)); }
    finally { setBusy(false); }
  }}>
    <p>สำหรับเจ้าหน้าที่ ปภ. ลำห้วยหลัว ใช้บัญชีที่ผู้ดูแลจัดให้</p>
    <label>อีเมล<input type="email" required autoComplete="username" inputMode="email" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
    {!reset && <label>รหัสผ่าน<div className="password-field"><input type={show ? "text" : "password"} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /><button type="button" className="icon-button" aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={20} /> : <Eye size={20} />}</button></div></label>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {message && <p className="info-box" role="status">{message}</p>}
    <button className="primary" type="submit" disabled={busy}>{reset ? <Mail size={19} /> : <Lock size={19} />}{busy ? "กำลังดำเนินการ…" : reset ? "ส่งลิงก์ตั้งรหัสผ่านใหม่" : "เข้าสู่ระบบและเปิดข้อมูลจริง"}</button>
    <button className="secondary" type="button" disabled={busy} onClick={() => { setReset(!reset); setPassword(""); setError(""); setMessage(""); }}>{reset ? "กลับไปเข้าสู่ระบบ" : "ลืมรหัสผ่าน"}</button>
    <small className="muted">ยังไม่มีบัญชี? ติดต่อผู้ดูแลศูนย์เพื่อเพิ่มบัญชีและกำหนดสิทธิ์</small>
  </form>;
}
