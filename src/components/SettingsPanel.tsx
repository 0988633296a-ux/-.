"use client";
import { type Store } from "@/lib/model";
import { client } from "@/lib/persistence";
import LoginForm from "./LoginForm";
import { defaultConnection } from "@/lib/supabase-config";
import { Database, Download, Lock, LogOut, Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
export default function SettingsPanel({
  store,
  notify,
  setUser,
  role,
  setRole,
  install,
  live,
  pending,
  onLive,
  onSync,
  onDemo,
  onRecover,
}: {
  live: boolean;
  pending: number;
  onLive: () => Promise<boolean>;
  onSync: () => void;
  onDemo: () => void;
  onRecover: () => void;
  store: Store;
  notify: (s: string) => void;
  setUser: (s: string) => void;
  role: string;
  setRole: (s: string) => void;
  install: any;
}) {
  const [config, setConfig] = useState(defaultConnection);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem("drc-connection");
      if (savedConfig) setConfig(JSON.parse(savedConfig));
      const c = client();
      c?.auth.getSession()
        .then(({ data }) => {
          setSignedIn(!!data.session);
          if (data.session) setUser(data.session.user.email || "");
        });
      const subscription = c?.auth.onAuthStateChange((_event, session) => {
        setSignedIn(!!session);
      });
      return () => subscription?.data.subscription.unsubscribe();
    } catch {}
  }, [setUser]);
  return (
    <div className="settings-grid">
      <section className="card padded">
        <h2>
          <Database size={21} />
          การเชื่อมต่อ Supabase
        </h2>
        <div className="info-box">
          <Lock size={21} />
          <span>
            ตั้งค่าการเชื่อมต่อ ปภ. ลำห้วยหลัวแล้ว เข้าสู่ระบบและกด
            “เปิดข้อมูลหน่วยงานจริง” เพื่อเริ่มบันทึกงาน
            ข้อมูลตัวอย่างแยกจากข้อมูลจริงเสมอ
          </span>
        </div>
        <form
          className="incident-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              new URL(config.url);
              localStorage.setItem("drc-connection", JSON.stringify(config));
              notify("บันทึกการเชื่อมต่อแล้ว");
            } catch {
              notify("กรุณาระบุ URL ของ Supabase ให้ถูกต้อง");
            }
          }}
        >
          <label>
            Supabase Project URL
            <input
              type="url"
              required
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              placeholder="https://your-project.supabase.co"
            />
          </label>
          <label>
            Publishable / anon key
            <input
              type="password"
              required
              value={config.key}
              onChange={(e) => setConfig({ ...config, key: e.target.value })}
              autoComplete="off"
              placeholder="ใช้เฉพาะ public key"
            />
          </label>
          <small className="muted">ห้ามใช้ service_role key ในเว็บแอป</small>
          <button className="secondary" type="submit">
            <Save size={17} />
            บันทึกการเชื่อมต่อ
          </button>
        </form>
        <h3>เข้าสู่ระบบหน่วยงาน</h3>
        {signedIn ? (
          <div className="live-controls">
            <button className="primary" onClick={live ? onSync : onLive}>
              {live
                ? `ซิงก์ข้อมูล (รอส่ง ${pending})`
                : "เปิดข้อมูลหน่วยงานจริง"}
            </button>
            {live && pending > 0 && (
              <button className="secondary" onClick={onRecover}>
                ตรวจข้อขัดแย้ง / ใช้ข้อมูลจากศูนย์
              </button>
            )}
            {live && (
              <button className="secondary" onClick={onDemo}>
                กลับข้อมูลตัวอย่าง
              </button>
            )}
            <button
              className="secondary"
              onClick={async () => {
                if (pending) {
                  notify("กรุณาซิงก์ข้อมูลรอส่งก่อนออกจากระบบ");
                  return;
                }
                const result = await client()?.auth.signOut({ scope: "local" });
                if (result?.error) {
                  notify("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
                  return;
                }
                localStorage.removeItem("drc-mode");
                setSignedIn(false);
                setUser("");
                notify("ออกจากระบบแล้ว");
                onDemo();
              }}
            >
              <LogOut size={18} />
              ออกจากระบบ
            </button>
          </div>
        ) : (
          <LoginForm onSuccess={async () => {
            const opened = await onLive();
            setSignedIn(true);
            return opened;
          }} />
        )}
      </section>
      <div>
        <section className="card padded">
          <h2>ข้อมูลและการใช้งานออฟไลน์</h2>
          <p>
            ข้อความ แบบฟอร์ม เหตุ และประวัติถูกเก็บในอุปกรณ์นี้
            ภาพถูกเก็บแยกในฐานข้อมูลของเบราว์เซอร์
          </p>
          <button
            className="secondary"
            onClick={() => {
              const b = new Blob([JSON.stringify(store, null, 2)], {
                type: "application/json",
              });
              const u = URL.createObjectURL(b);
              const a = document.createElement("a");
              a.href = u;
              a.download = `drc-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(u);
              notify("ส่งออกข้อมูลแล้ว ไฟล์นี้ไม่รวมไฟล์ภาพ");
            }}
          >
            <Download size={18} />
            สำรองข้อมูล JSON
          </button>
          <p className="muted">
            ไฟล์สำรองไม่รวมภาพ ให้เก็บรายงาน PDF ที่มีภาพเพิ่มเติม
          </p>
          <button
            className="secondary"
            onClick={async () => {
              if (install) {
                await install.prompt();
              } else
                notify(
                  "เปิดเมนูเบราว์เซอร์แล้วเลือก เพิ่มไปยังหน้าจอโฮม / ติดตั้งแอป",
                );
            }}
          >
            <Plus size={18} />
            เพิ่มไปยังหน้าจอโฮม
          </button>
        </section>
        <section className="card padded">
          <h2>สิทธิ์การเข้าถึง</h2>
          <p>
            ระบบจริงกำหนดบทบาทจากฐานข้อมูลและบังคับด้วย RLS
            บทบาทที่แสดงในโหมดตัวอย่างใช้สำหรับการทดลองเท่านั้น
          </p>
          <label>
            {live ? "บทบาทจากหน่วยงาน" : "บทบาทแสดงผลในโหมดตัวอย่าง"}
            <select
              disabled={live}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {[
                "Administrator",
                "หัวหน้าศูนย์",
                "เจ้าหน้าที่รับแจ้ง",
                "เจ้าหน้าที่ภาคสนาม",
                "ผู้ดูรายงาน",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <div className="info-box">
            {live
              ? `เชื่อมข้อมูลจริง · รอส่ง ${pending} รายการ`
              : "เข้าสู่ระบบและเปิดข้อมูลจริงเพื่อเริ่มซิงก์"}
          </div>
        </section>
      </div>
    </div>
  );
}
