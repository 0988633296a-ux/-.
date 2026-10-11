"use client";
import { localizeDemoStore } from "@/lib/demo-migration";
import { defaultAgency } from "@/lib/agency";
import Dialog from "@/components/Dialog";
import IncidentForm from "@/components/IncidentForm";
import PhotoCard from "@/components/PhotoCard";
import ResourceForm from "@/components/ResourceForm";
import SettingsPanel from "@/components/SettingsPanel";
import LoginForm from "@/components/LoginForm";
import ActivateAccount from "@/components/ActivateAccount";
import WeatherPanel from "@/components/WeatherPanel";
import Statistics from "@/components/Statistics";
import LineNotifications from "@/components/LineNotifications";
import {
  flushOperations,
  loadAgency,
  pendingCount,
  queueOperation,
} from "@/lib/backend";
import {
  active,
  checks,
  date,
  seed,
  statuses,
  time,
  types,
  uid,
  type Incident,
  type Photo,
  type Resource,
  type Store,
} from "@/lib/model";
import { client, putPhoto, saveStore, STORE_KEY } from "@/lib/persistence";
import { printReport } from "@/lib/report";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CloudSun,
  ExternalLink,
  Eye,
  FileText,
  Flame,
  HeartPulse,
  History,
  LayoutDashboard,
  MapPin,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  Radio,
  Save,
  Search,
  Settings,
  Share2,
  ShieldPlus,
  TreePine,
  Truck,
  Users,
  Waves,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
const MapView = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="map loading">กำลังโหลดแผนที่…</div>,
});
const checklistLabels = (i: Incident): string[] =>
  i.checkItems?.length
    ? i.checkItems.map((c) => c.label)
    : [
        ...checks,
        ...(i.type.includes("ไฟ")
          ? ["ตรวจแหล่งน้ำและเส้นทางเข้าเหตุ"]
          : i.type === "น้ำท่วม"
            ? ["ตรวจเสื้อชูชีพและอุปกรณ์ทางน้ำ"]
            : []),
      ];
const requiredCheckLabels = (i: Incident) =>
  i.checkItems?.length
    ? i.checkItems.filter((c) => c.required).map((c) => c.label)
    : checklistLabels(i);
const nav = [
  { label: "หน้าหลัก", icon: LayoutDashboard },
  { label: "เหตุ", icon: Flame },
  { label: "แผนที่", icon: MapPin },
  { label: "ทรัพยากร", icon: Truck },
  { label: "เพิ่มเติม", icon: MoreHorizontal },
];
const iconFor = (type: string) =>
  type.includes("ไฟ")
    ? Flame
    : type === "ต้นไม้ล้ม"
      ? TreePine
      : type === "น้ำท่วม"
        ? Waves
        : type === "อุบัติเหตุ"
          ? HeartPulse
          : ShieldPlus;
const badgeClass = (s: string) =>
  s === "วิกฤต"
    ? "red"
    : s === "เร่งด่วน"
      ? "orange"
      : s === "เฝ้าระวัง"
        ? "yellow"
        : s === "เสร็จสิ้น" || s === "พร้อม"
          ? "green"
          : s === "ซ่อม" || s === "ไม่พร้อม"
            ? "red"
            : "blue";
function Badge({ text }: { text: string }) {
  return (
    <span className={`badge ${badgeClass(text)}`}>
      <span />
      {text}
    </span>
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
export default function App() {
  const [agency, setAgency] = useState(defaultAgency.name);
  const authEpoch = useRef(0);
  const [loginOpen, setLoginOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [liveUser, setLiveUser] = useState("");
  const [pending, setPending] = useState(0);
  const [syncState, setSyncState] = useState("");
  const [store, setStore] = useState<Store | null>(null);
  const [page, setPage] = useState("หน้าหลัก");
  const [selected, setSelected] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ทั้งหมด");
  const [resourceTab, setResourceTab] = useState("กำลังพล");
  const [moreTab, setMoreTab] = useState("สถิติและรายงาน");
  const [photoPhase, setPhotoPhase] = useState("ก่อนดำเนินการ");
  const [detailTab, setDetailTab] = useState("ข้อมูลเหตุ");
  const [editResource, setEditResource] = useState<{
    kind: string;
    resource?: Resource;
  } | null>(null);
  const [install, setInstall] = useState<any>(null);
  const [sessionUser, setSessionUser] = useState("");
  const [role, setRole] = useState("หัวหน้าศูนย์");
  const [dateFilter, setDateFilter] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("ทั้งหมด");
  const notify = useCallback((s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 4500);
  }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      setStore(saved ? localizeDemoStore(JSON.parse(saved)) : seed());
    } catch {
      setStore(seed());
      notify("ไม่สามารถอ่านข้อมูลในเครื่อง กรุณาตรวจสอบพื้นที่จัดเก็บ");
    }
    setOnline(navigator.onLine);
    const on = () => setOnline(navigator.onLine);
    const before = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("beforeinstallprompt", before);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("beforeinstallprompt", before);
    };
  }, [notify]);
  useEffect(() => {
    if (!store) return;
    try {
      if (live)
        localStorage.setItem("drc-live-" + liveUser, JSON.stringify(store));
      else saveStore(store);
    } catch {
      notify(
        "บันทึกไม่สำเร็จ: พื้นที่จัดเก็บเต็ม กรุณาส่งออกข้อมูลก่อนปิดหน้า",
      );
    }
  }, [store, notify, live, liveUser]);
  const open = useCallback((id: string) => {
    setSelected(id);
    setDetailTab("ข้อมูลเหตุ");
  }, []);
  const actor = sessionUser || "เจ้าหน้าที่ศูนย์ (ข้อมูลตัวอย่าง)";
  const sync = useCallback(
    async (userId: string) => {
      if (!navigator.onLine) return;
      const epoch = authEpoch.current;
      setSyncState("กำลังซิงก์");
      try {
        await flushOperations(userId, count => { if (epoch === authEpoch.current) setPending(count); });
        const loaded = await loadAgency();
        if (epoch !== authEpoch.current) return;
        if (pendingCount(userId) === 0) {
          setStore(loaded.store);
          localStorage.setItem(
            "drc-live-" + userId,
            JSON.stringify(loaded.store),
          );
          setSyncState("ซิงก์แล้ว");
        } else setSyncState("รอซิงก์");
      } catch (e) {
        if (epoch !== authEpoch.current) return;
        setSyncState("รอตรวจสอบ");
        notify(
          "ข้อมูลยังอยู่ในเครื่อง: " +
            (e instanceof Error ? e.message : "ซิงก์ไม่สำเร็จ"),
        );
      }
    },
    [notify],
  );
  const enableLive = useCallback(async () => {
    const epoch = authEpoch.current;
    try {
      const loaded = await loadAgency();
      if (epoch !== authEpoch.current) return false;
      setAgency(loaded.agency);
      setLiveUser(loaded.userId);
      setSessionUser(loaded.name);
      setRole(loaded.role);
      setLive(true);
      localStorage.setItem("drc-mode", "live");
      const count = pendingCount(loaded.userId);
      setPending(count);
      const cached = localStorage.getItem("drc-live-" + loaded.userId);
      setStore(count && cached ? JSON.parse(cached) : loaded.store);
      setSelected(null);
      setSyncState(count ? "รอซิงก์" : "ซิงก์แล้ว");
      notify("เปิดข้อมูลหน่วยงานจริงแล้ว");
      if (count) sync(loaded.userId);
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "โหลดข้อมูลจริงไม่สำเร็จ");
      return false;
    }
  }, [notify, sync]);
  useEffect(() => {
    if (localStorage.getItem("drc-mode") !== "live" || window.location.hash || new URLSearchParams(window.location.search).has("auth")) return;
    let active = true;
    const c = client();
    c?.auth.getSession().then(({ data }) => {
      if (active && data.session && navigator.onLine) void enableLive();
    });
    return () => { active = false; };
  }, [enableLive]);
  useEffect(() => {
    const subscription = client()?.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      authEpoch.current++;
      localStorage.removeItem("drc-mode");
      setLive(false); setLiveUser(""); setSessionUser(""); setPending(0);
      setSelected(null); setCreate(false); setEditResource(null);
      setAgency(defaultAgency.name); setRole("หัวหน้าศูนย์");
      setStore(JSON.parse(localStorage.getItem(STORE_KEY) || "null") || seed());
      notify("ออกจากระบบแล้ว ข้อมูลรอส่งยังเก็บในเครื่องของบัญชีเดิม");
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [notify]);
  useEffect(() => {
    if (!live || !liveUser) return;
    const fn = () => sync(liveUser);
    window.addEventListener("online", fn);
    return () => window.removeEventListener("online", fn);
  }, [live, liveUser, sync]);
  const mutate = (
    next: Store,
    action: string,
    before: unknown,
    after: unknown,
    incidentId?: string,
  ) => {
    if (live && role === "ผู้ดูรายงาน") {
      notify("บทบาทนี้มีสิทธิ์ดูรายงานเท่านั้น");
      return false;
    }
    if (
      live &&
      role === "เจ้าหน้าที่ภาคสนาม" &&
      ![
        "เปลี่ยนสถานะ",
        "ตรวจ Checklist",
        "เพิ่มภาพหน้างาน",
        "แก้คำอธิบายภาพ",
        "บันทึกผลการดำเนินงาน",
      ].includes(action)
    ) {
      notify("รายการนี้ต้องดำเนินการโดยเจ้าหน้าที่ศูนย์");
      return false;
    }
    next.audit = [
      {
        id: uid(),
        at: new Date().toISOString(),
        actor,
        action,
        before,
        after,
        incidentId,
      },
      ...next.audit,
    ];
    try {
      if (live) {
        const oldIncident = store?.incidents.find((i) => i.id === incidentId);
        const newIncident = next.incidents.find((i) => i.id === incidentId);
        const kind =
          editResource?.kind === "กำลังพล"
            ? "staff"
            : editResource?.kind === "ยานพาหนะ"
              ? "vehicles"
              : "equipment";
        localStorage.setItem("drc-live-" + liveUser, JSON.stringify(next));
        queueOperation({
          userId: liveUser,
          kind: action,
          before: oldIncident || before,
          after: newIncident || after,
          incidentId,
          expectedVersion: oldIncident?.version,
          resourceKind: kind,
        });
        setPending(pendingCount(liveUser));
        setSyncState("รอซิงก์");
        setTimeout(() => sync(liveUser), 250);
      } else saveStore(next);
      setStore(next);
    } catch {
      notify("บันทึกไม่สำเร็จ พื้นที่ในเครื่องเต็ม");
      return false;
    }
    return true;
  };
  const update = (i: Incident, action: string) => {
    if (!store) return;
    const old = store.incidents.find((x) => x.id === i.id);
    mutate(
      {
        ...store,
        incidents: store.incidents.map((x) =>
          x.id === i.id ? { ...i, version: i.version + 1 } : x,
        ),
      },
      action,
      old,
      i,
      i.id,
    );
  };
  if (!store)
    return (
      <div className="boot">
        <ShieldPlus size={42} />
        <h2>ศูนย์บริหารจัดการเหตุสาธารณภัย</h2>
        <p>กำลังเตรียมข้อมูล…</p>
      </div>
    );
  const incidents = store.incidents.filter((i) => !i.deletedAt);
  const current = incidents.find((i) => i.id === selected);
  const ongoing = incidents.filter(active);
  const urgent = ongoing.filter((i) => ["วิกฤต", "เร่งด่วน"].includes(i.level));
  const today = incidents.filter(
    (i) => new Date(i.reportedAt).toDateString() === new Date().toDateString(),
  );
  const filtered = incidents.filter(
    (i) =>
      (filter === "ทั้งหมด" ||
        (filter === "กำลังดำเนินการ" && active(i)) ||
        (filter === "ปิดแล้ว" && i.status === "เสร็จสิ้น") ||
        (filter === "รับแจ้ง" && i.status === "รับแจ้ง")) &&
      (typeFilter === "ทั้งหมด" || i.type === typeFilter) &&
      (!dateFilter || i.reportedAt.slice(0, 10) >= dateFilter) &&
      (!endDate || i.reportedAt.slice(0, 10) <= endDate) &&
      [
        i.title,
        i.address,
        i.number,
        i.reporter,
        i.area,
        ...i.staff.map(
          (id) => store.staff.find((s) => s.id === id)?.name || "",
        ),
        ...i.vehicles.map(
          (id) => store.vehicles.find((s) => s.id === id)?.name || "",
        ),
      ]
        .join(" ")
        .includes(search),
  );
  const go = (p: string) => {
    setPage(p);
    setSelected(null);
    setSearch("");
    setFilter("ทั้งหมด");
    setMenu(false);
  };
  const advance = (i: Incident) => {
    if (
      live &&
      role === "เจ้าหน้าที่ภาคสนาม" &&
      ["รับแจ้ง", "ตรวจสอบ"].includes(i.status)
    ) {
      notify("กรุณาให้ศูนย์ตรวจสอบและจัดกำลังก่อน");
      return;
    }
    const index = statuses.indexOf(i.status as any);
    const next = statuses[index + 1];
    if (!next || i.status === "เสร็จสิ้น" || i.status === "ยกเลิก") return;
    if (
      next === "ออกปฏิบัติการ" &&
      (!i.staff.length ||
        !i.vehicles.length ||
        !requiredCheckLabels(i).every((c) => i.checks.includes(c)))
    ) {
      notify("กรุณามอบหมายเจ้าหน้าที่ รถ และตรวจ Checklist ให้ครบก่อนออก");
      setDetailTab(
        !i.staff.length || !i.vehicles.length ? "จัดกำลัง" : "Checklist",
      );
      return;
    }
    if (next === "เสร็จสิ้น") {
      setDetailTab("รายงาน");
      if (!i.result.trim() || !i.commander.trim()) {
        notify("กรอกผลการดำเนินงานและผู้ควบคุมเหตุก่อนปิดเหตุ");
        return;
      }
    }
    const updated = {
      ...i,
      status: next,
      version: i.version + 1,
      timeline: [
        ...i.timeline,
        {
          id: uid(),
          at: new Date().toISOString(),
          actor,
          from: i.status,
          to: next,
        },
      ],
    };
    let ns = {
      ...store,
      incidents: store.incidents.map((x) => (x.id === i.id ? updated : x)),
    };
    if (next === "เสร็จสิ้น")
      ns = {
        ...ns,
        staff: ns.staff.map((r) =>
          i.staff.includes(r.id) ? { ...r, status: "พร้อม" } : r,
        ),
        vehicles: ns.vehicles.map((r) =>
          i.vehicles.includes(r.id) ? { ...r, status: "พร้อม" } : r,
        ),
        equipment: ns.equipment.map((r) =>
          i.equipment[r.id]
            ? { ...r, ready: (r.ready || 0) + i.equipment[r.id] }
            : r,
        ),
      };
    if (mutate(ns, "เปลี่ยนสถานะ", i.status, next, i.id))
      notify(`บันทึกสถานะ “${next}” แล้ว`);
  };
  const assign = (
    i: Incident,
    kind: "staff" | "vehicles" | "equipment",
    id: string,
    quantity = 1,
  ) => {
    const res = store[kind].find((r) => r.id === id)!;
    const assigned =
      kind === "equipment"
        ? !!i.equipment[id]
        : (i[kind] as string[]).includes(id);
    if (!assigned && kind !== "equipment" && res.status !== "พร้อม") {
      notify("ทรัพยากรนี้ไม่พร้อมหรือกำลังปฏิบัติงาน");
      return;
    }
    if (!assigned && kind === "equipment" && (res.ready || 0) < quantity) {
      notify("อุปกรณ์พร้อมไม่เพียงพอ");
      return;
    }
    const nextI =
      kind === "equipment"
        ? {
            ...i,
            equipment: assigned
              ? Object.fromEntries(
                  Object.entries(i.equipment).filter(([k]) => k !== id),
                )
              : { ...i.equipment, [id]: quantity },
            version: i.version + 1,
          }
        : {
            ...i,
            [kind]: assigned
              ? (i[kind] as string[]).filter((x) => x !== id)
              : [...(i[kind] as string[]), id],
            version: i.version + 1,
          };
    const nextResources = store[kind].map((r) =>
      r.id !== id
        ? r
        : kind === "equipment"
          ? {
              ...r,
              ready: (r.ready || 0) + (assigned ? i.equipment[id] : -quantity),
            }
          : { ...r, status: assigned ? "พร้อม" : "ปฏิบัติงาน" },
    );
    if (
      mutate(
        {
          ...store,
          [kind]: nextResources,
          incidents: store.incidents.map((x) => (x.id === i.id ? nextI : x)),
        },
        assigned ? "ถอนการมอบหมาย" : "มอบหมายทรัพยากร",
        i,
        nextI,
        i.id,
      )
    )
      notify(assigned ? "ถอนการมอบหมายแล้ว" : "มอบหมายแล้ว");
  };
  const incidentTable = (items: Incident[], compact = false) => (
    <div className="incident-list">
      <div className="table-head">
        <span>เหตุ / สถานที่</span>
        <span>รับแจ้ง</span>
        <span>ระดับเหตุ</span>
        <span>สถานะ</span>
        <span>ทีมรับผิดชอบ</span>
        <span />
      </div>
      {items.length ? (
        items.map((i) => {
          const Icon = iconFor(i.type);
          return (
            <button
              className="incident-row"
              key={i.id}
              onClick={() => open(i.id)}
            >
              <div className="incident-name">
                <span className={`type-icon ${badgeClass(i.level)}`}>
                  <Icon size={21} />
                </span>
                <div>
                  <strong>{i.title}</strong>
                  <small>
                    <MapPin size={12} />
                    {i.address}
                  </small>
                  <span className="mobile-meta">
                    {time(i.reportedAt)} น. · {i.number}
                  </span>
                </div>
              </div>
              <div className="time-cell">
                <strong>{time(i.reportedAt)}</strong>
                <small>{date(i.reportedAt)}</small>
              </div>
              <div>
                <Badge text={i.level} />
              </div>
              <div>
                <Badge text={i.status} />
              </div>
              <div className="team-cell">
                {i.staff.length ? (
                  <>
                    <span className="team-dot">
                      <Users size={13} />
                    </span>
                    {store.staff.find((s) => s.id === i.staff[0])?.unit ||
                      "ชุดปฏิบัติการ"}
                    <small>
                      {i.staff.length} เจ้าหน้าที่ · {i.vehicles.length} คัน
                    </small>
                  </>
                ) : (
                  <span className="muted">ยังไม่มอบหมาย</span>
                )}
              </div>
              <ChevronRight size={17} />
            </button>
          );
        })
      ) : (
        <Empty text="ไม่พบเหตุที่ตรงกับเงื่อนไข" />
      )}
    </div>
  );
  return (
    <div className="app">
      <ActivateAccount />
      {loginOpen && <Dialog title="เข้าสู่ระบบเจ้าหน้าที่" subtitle={defaultAgency.name} onClose={() => setLoginOpen(false)}>
        <LoginForm onSuccess={async () => {
          const opened = await enableLive();
          if (opened) { setLoginOpen(false); setPage("หน้าหลัก"); }
          return opened;
        }} />
      </Dialog>}
      <aside className={`sidebar ${menu ? "shown" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("หน้าหลัก");
          }}
        >
          <span className="brand-icon">
            <ShieldPlus size={29} />
          </span>
          <div>
            <strong>
              DISASTER
              <br />
              RESPONSE CENTER
            </strong>
            <small>ระบบบริหารจัดการเหตุสาธารณภัย</small>
          </div>
        </a>
        <div className="unit-select">
          <span className="unit-emblem">
            <Building2 size={19} />
          </span>
          <div>
            <strong>{agency}</strong>
            <small>
              {live ? "หน่วยงานที่เข้าสู่ระบบ" : defaultAgency.address}
            </small>
          </div>
          <ChevronDown size={16} />
        </div>
        <span className="nav-caption">ศูนย์ปฏิบัติการ</span>
        <nav>
          {nav.map((n) => (
            <button
              key={n.label}
              className={page === n.label ? "active" : ""}
              onClick={() => go(n.label)}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
              {n.label === "เหตุ" && <b>{ongoing.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <button
          className="side-sub"
          onClick={() => {
            go("เพิ่มเติม");
            setMoreTab("สถิติและรายงาน");
          }}
        >
          <BarChart3 size={19} />
          สถิติและรายงาน
        </button>
        <button
          className="side-sub"
          onClick={() => {
            go("เพิ่มเติม");
            setMoreTab("การตั้งค่า");
          }}
        >
          <Settings size={19} />
          การตั้งค่า
        </button>
        <div className="sidebar-bottom">
          <div className="demo-side">
            <span>{live ? "ข้อมูลหน่วยงานจริง" : "ข้อมูลตัวอย่าง"}</span>
            <small>
              {live ? "เชื่อมต่อ Supabase" : "สำหรับทดลองใช้งานระบบ"}
            </small>
          </div>
          <div className="support">
            <Radio size={18} />
            <div>
              สายด่วนสาธารณภัย<strong>1784</strong>
            </div>
          </div>
          <div className="sidebar-user">
            <div className="avatar">ศป</div>
            <div>
              <strong>{sessionUser || "เจ้าหน้าที่ศูนย์"}</strong>
              <small>
                {role} · {live ? "ข้อมูลจริง" : "โหมดตัวอย่าง"}
              </small>
            </div>
            <button
              aria-label="การตั้งค่าผู้ใช้"
              onClick={() => {
                go("เพิ่มเติม");
                setMoreTab("การตั้งค่า");
              }}
            >
              <Settings size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="top-left">
            <button
              className="mobile-menu icon-button"
              aria-label="เปิดเมนู"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              ศูนย์ปฏิบัติการ <ChevronRight size={13} /> <strong>{page}</strong>
            </span>
          </div>
          <div className="top-right">
            <button className="secondary auth-entry" onClick={() => {
              if (live) { go("เพิ่มเติม"); setMoreTab("การตั้งค่า"); }
              else setLoginOpen(true);
            }}>{live ? "บัญชีผู้ใช้" : "เข้าสู่ระบบ"}</button>
            <span className={`connection ${online ? "" : "offline"}`}>
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
              {!online
                ? "ออฟไลน์"
                : live && syncState === "กำลังซิงก์"
                  ? "กำลังซิงก์"
                  : live && pending
                    ? `รอส่ง ${pending}`
                    : "ออนไลน์"}
            </span>
            <span className="top-date">
              <CalendarDays size={15} />
              {date(new Date().toISOString())}
            </span>
            <button
              className="bell icon-button"
              aria-label="การแจ้งเตือน"
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={20} />
              {urgent.length > 0 && <i />}
            </button>
            <span className="top-avatar">ศป</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                DISASTER RESPONSE CENTER{" "}
                <span>{live ? "ข้อมูลหน่วยงานจริง" : "ข้อมูลตัวอย่าง"}</span>
              </div>
              <h1>
                {page === "หน้าหลัก"
                  ? "ภาพรวมสถานการณ์"
                  : page === "เหตุ"
                    ? "จัดการเหตุสาธารณภัย"
                    : page === "แผนที่"
                      ? "แผนที่สถานการณ์"
                      : page === "ทรัพยากร"
                        ? "ความพร้อมทรัพยากร"
                        : "ศูนย์ข้อมูลและการตั้งค่า"}
              </h1>
              <p>
                {page === "หน้าหลัก"
                  ? "ติดตามเหตุและความพร้อมของหน่วยปฏิบัติการ"
                  : page === "เหตุ"
                    ? "รับแจ้ง จัดกำลัง และติดตามทุกขั้นตอนในที่เดียว"
                    : page === "แผนที่"
                      ? "ตำแหน่งเหตุ จุดสำคัญ และพื้นที่เฝ้าระวัง"
                      : page === "ทรัพยากร"
                        ? "ตรวจสอบกำลังพล ยานพาหนะ และอุปกรณ์ก่อนออกปฏิบัติงาน"
                        : "รายงาน ประวัติการดำเนินงาน และการเชื่อมต่อระบบ"}
              </p>
            </div>
            <button
              className="primary new-incident"
              onClick={() => setCreate(true)}
            >
              <Plus size={20} /> แจ้งเหตุ
            </button>
          </div>
          {page === "หน้าหลัก" && (
            <>
              <div className="section-kicker">
                <span>
                  <span className="live-dot" />
                  สถานการณ์วันนี้
                </span>
                <small>
                  {date(new Date().toISOString())}{" "}
                  <span className="desktop-only">
                    · {live ? "อัปเดตจากหน่วยงาน" : "อัปเดตจากข้อมูลในเครื่อง"}
                  </span>
                </small>
              </div>
              <WeatherPanel compact />
              <div className="kpi-grid">
                {[
                  {
                    label: "เหตุวันนี้",
                    value: today.length,
                    icon: Flame,
                    color: "blue",
                    note: "เหตุทั้งหมดที่รับแจ้ง",
                    click: "ทั้งหมด",
                  },
                  {
                    label: "กำลังดำเนินการ",
                    value: ongoing.length,
                    icon: Radio,
                    color: "orange",
                    note: "อยู่ระหว่างปฏิบัติงาน",
                    click: "กำลังดำเนินการ",
                  },
                  {
                    label: "ปิดเหตุแล้ว",
                    value: today.filter((i) => i.status === "เสร็จสิ้น").length,
                    icon: CheckCircle2,
                    color: "green",
                    note: "ดำเนินการเสร็จสิ้น",
                    click: "ปิดแล้ว",
                  },
                  {
                    label: "เหตุเร่งด่วน",
                    value: urgent.length,
                    icon: AlertTriangle,
                    color: "red",
                    note: "ต้องติดตามอย่างใกล้ชิด",
                    click: "กำลังดำเนินการ",
                  },
                ].map((k, n) => (
                  <button
                    key={k.label}
                    className="kpi"
                    onClick={() => {
                      go("เหตุ");
                      setFilter(k.click);
                    }}
                  >
                    <div className="kpi-top">
                      <span>{k.label}</span>
                      <span className={`kpi-icon ${k.color}`}>
                        <k.icon size={20} />
                      </span>
                    </div>
                    <strong>
                      {k.value.toString().padStart(2, "0")}
                      <small>เหตุ</small>
                    </strong>
                    <div className="kpi-foot">
                      <span className={`mini-dot ${k.color}`} />
                      {k.note}
                      <ArrowUpRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
              {urgent.length > 0 && (
                <div className="urgent-strip">
                  <span className="urgent-symbol">
                    <AlertTriangle size={20} />
                  </span>
                  <div>
                    <strong>
                      เหตุที่ต้องติดตาม <b>{urgent.length} เหตุ</b>
                    </strong>
                    <p>
                      {urgent[0].title} · {urgent[0].address}
                    </p>
                  </div>
                  <Badge text={urgent[0].status} />
                  <button onClick={() => open(urgent[0].id)}>
                    ดูรายละเอียด <ChevronRight size={16} />
                  </button>
                </div>
              )}
              <div className="overview-grid">
                <section className="card map-card">
                  <div className="card-heading">
                    <h2>
                      <MapPin size={18} />
                      แผนที่สถานการณ์
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => go("แผนที่")}
                    >
                      เปิดแผนที่เต็ม <ExternalLink size={14} />
                    </button>
                  </div>
                  <div className="map-wrap">
                    <MapView
                      demo={!live}
                      locations={store.locations}
                      incidents={incidents}
                      onOpen={open}
                    />
                    <div className="map-overlay">
                      <span className="live-dot" /> {ongoing.length}{" "}
                      เหตุกำลังดำเนินการ
                    </div>
                  </div>
                  <div className="map-legend">
                    <span>
                      <i className="legend-dot orange" />
                      กำลังดำเนินการ
                    </span>
                    <span>
                      <i className="legend-dot green" />
                      ปิดแล้ว
                    </span>
                    <span>
                      <i className="legend-dot yellow" />
                      พื้นที่เฝ้าระวัง
                    </span>
                    <small>
                      {live ? "ข้อมูลหน่วยงานจริง" : "ข้อมูลตัวอย่าง"}
                    </small>
                  </div>
                </section>
                <section className="card readiness">
                  <div className="card-heading">
                    <h2>ความพร้อมปฏิบัติการ</h2>
                    <button
                      className="icon-button"
                      aria-label="ดูทรัพยากร"
                      onClick={() => go("ทรัพยากร")}
                    >
                      <MoreHorizontal size={19} />
                    </button>
                  </div>
                  <div className="readiness-content">
                    {[
                      {
                        icon: Users,
                        title: "กำลังพล",
                        ready: store.staff.filter((r) => r.status === "พร้อม")
                          .length,
                        total: store.staff.length,
                        unit: "นาย",
                        tab: "กำลังพล",
                        color: "blue",
                      },
                      {
                        icon: Truck,
                        title: "ยานพาหนะ",
                        ready: store.vehicles.filter(
                          (r) => r.status === "พร้อม",
                        ).length,
                        total: store.vehicles.length,
                        unit: "คัน",
                        tab: "ยานพาหนะ",
                        color: "green",
                      },
                    ].map((r) => (
                      <button
                        className="readiness-row"
                        key={r.title}
                        onClick={() => {
                          go("ทรัพยากร");
                          setResourceTab(r.tab);
                        }}
                      >
                        <span className={`resource-symbol ${r.color}`}>
                          <r.icon size={23} />
                        </span>
                        <div className="readiness-info">
                          <div>
                            <strong>{r.title}</strong>
                            <span>
                              <b>{r.ready}</b> / {r.total} {r.unit}
                            </span>
                          </div>
                          <div className={`progress ${r.color}`}>
                            <span
                              style={{ width: `${(r.ready / r.total) * 100}%` }}
                            />
                          </div>
                          <small>
                            พร้อมปฏิบัติงาน{" "}
                            <span>
                              {r.total - r.ready} {r.unit} ไม่อยู่ในสถานะพร้อม
                            </span>
                          </small>
                        </div>
                      </button>
                    ))}
                    <div className="vehicle-status">
                      <span>
                        <i className="mini-dot green" />
                        พร้อม{" "}
                        {
                          store.vehicles.filter((r) => r.status === "พร้อม")
                            .length
                        }
                      </span>
                      <span>
                        <i className="mini-dot orange" />
                        ออกปฏิบัติงาน{" "}
                        {
                          store.vehicles.filter(
                            (r) => r.status === "ปฏิบัติงาน",
                          ).length
                        }
                      </span>
                      <span>
                        <i className="mini-dot red" />
                        ซ่อม{" "}
                        {
                          store.vehicles.filter((r) => r.status === "ซ่อม")
                            .length
                        }
                      </span>
                    </div>
                    <button
                      className="equipment-alert"
                      onClick={() => {
                        go("ทรัพยากร");
                        setResourceTab("อุปกรณ์");
                      }}
                    >
                      <Package size={21} />
                      <div>
                        <strong>
                          อุปกรณ์ไม่พร้อม{" "}
                          <b>
                            {store.equipment.reduce(
                              (s, r) => s + (r.broken || 0),
                              0,
                            )}{" "}
                            ชิ้น
                          </b>
                        </strong>
                        <small>ตรวจสอบก่อนออกปฏิบัติงาน</small>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                    <button
                      className="resource-link"
                      onClick={() => go("ทรัพยากร")}
                    >
                      ดูทรัพยากรทั้งหมด <ChevronRight size={15} />
                    </button>
                  </div>
                </section>
              </div>
              <section className="card latest">
                <div className="card-heading">
                  <h2>
                    เหตุล่าสุด{" "}
                    <span className="count-pill">{incidents.length}</span>
                  </h2>
                  <button className="text-button" onClick={() => go("เหตุ")}>
                    ดูเหตุทั้งหมด <ChevronRight size={15} />
                  </button>
                </div>
                <div className="latest-tabs">
                  {["ทั้งหมด", "กำลังดำเนินการ", "ปิดแล้ว"].map((s) => (
                    <button
                      className={filter === s ? "chosen" : ""}
                      key={s}
                      onClick={() => setFilter(s)}
                    >
                      {s} {s === "ทั้งหมด" && <span>{incidents.length}</span>}
                    </button>
                  ))}
                  <span className="table-caption">
                    คลิกรายการเพื่อดูรายละเอียด
                  </span>
                </div>
                {incidentTable(filtered.slice(0, 5), true)}
              </section>
            </>
          )}
          {page === "เหตุ" && (
            <section className="card">
              <div className="filters">
                <div className="search">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ค้นหาเลขเหตุ สถานที่ ผู้แจ้ง รถ หรือเจ้าหน้าที่"
                    aria-label="ค้นหาเหตุ"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label="สถานะเหตุ"
                >
                  {["ทั้งหมด", "รับแจ้ง", "กำลังดำเนินการ", "ปิดแล้ว"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  aria-label="ประเภทเหตุ"
                >
                  {["ทั้งหมด", ...types].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <label className="date-label">
                  ตั้งแต่
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                </label>
                <label className="date-label">
                  ถึง
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
                <button
                  className="text-button"
                  onClick={() => {
                    setSearch("");
                    setFilter("ทั้งหมด");
                    setTypeFilter("ทั้งหมด");
                    setDateFilter("");
                    setEndDate("");
                  }}
                >
                  ล้างตัวกรอง
                </button>
              </div>
              <div className="list-summary">
                พบ {filtered.length} เหตุ{" "}
                <span>{live ? "ข้อมูลหน่วยงานจริง" : "ข้อมูลตัวอย่าง"}</span>
              </div>
              {incidentTable(filtered)}
            </section>
          )}
          {page === "แผนที่" && (
            <section className="card">
              <div className="card-heading">
                <h2>
                  <MapPin size={20} />
                  พื้นที่ปฏิบัติการ
                </h2>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label="กรองหมุด"
                >
                  {["ทั้งหมด", "เหตุใหม่", "กำลังดำเนินการ", "ปิดแล้ว"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </div>
              <MapView
                demo={!live}
                locations={store.locations}
                large
                incidents={incidents}
                filter={filter}
                onOpen={open}
              />
              <div className="map-legend">
                <span>
                  <i className="legend-dot orange" />
                  เหตุปฏิบัติการ
                </span>
                <span>
                  <i className="legend-dot green" />
                  เหตุปิดแล้ว
                </span>
                <span>
                  <i className="legend-dot yellow" />
                  พื้นที่เฝ้าระวัง
                </span>
                <span>
                  <i className="legend-dot blue" />
                  จุดสำคัญ
                </span>
              </div>
              <p className="map-note">
                แตะหมุดเพื่อดูเหตุหรือจุดสำคัญ ·{" "}
                {live
                  ? "ข้อมูลเหตุจากหน่วยงาน"
                  : "ตำแหน่งในชุดตัวอย่างไม่ใช่เหตุจริง"}
              </p>
            </section>
          )}
          {page === "ทรัพยากร" && (
            <>
              <div className="page-tabs">
                {["กำลังพล", "ยานพาหนะ", "อุปกรณ์"].map((t) => (
                  <button
                    className={resourceTab === t ? "active" : ""}
                    key={t}
                    onClick={() => {
                      setResourceTab(t);
                      setSearch("");
                    }}
                  >
                    {t === "กำลังพล" ? (
                      <Users size={18} />
                    ) : t === "ยานพาหนะ" ? (
                      <Truck size={18} />
                    ) : (
                      <Package size={18} />
                    )}{" "}
                    {t}{" "}
                    <span>
                      {
                        store[
                          t === "กำลังพล"
                            ? "staff"
                            : t === "ยานพาหนะ"
                              ? "vehicles"
                              : "equipment"
                        ].length
                      }
                    </span>
                  </button>
                ))}
              </div>
              <div className="resource-toolbar">
                <div className="search">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`ค้นหา${resourceTab}`}
                    aria-label={`ค้นหา${resourceTab}`}
                  />
                </div>
                <button
                  className="secondary"
                  onClick={() => setEditResource({ kind: resourceTab })}
                >
                  <Plus size={18} />
                  เพิ่ม{resourceTab}
                </button>
              </div>
              <div className="resource-grid">
                {store[
                  resourceTab === "กำลังพล"
                    ? "staff"
                    : resourceTab === "ยานพาหนะ"
                      ? "vehicles"
                      : "equipment"
                ]
                  .filter((r) =>
                    [r.name, r.type, r.plate, r.unit]
                      .join(" ")
                      .includes(search),
                  )
                  .map((r) => {
                    const attached = ongoing.find((i) =>
                      resourceTab === "กำลังพล"
                        ? i.staff.includes(r.id)
                        : resourceTab === "ยานพาหนะ"
                          ? i.vehicles.includes(r.id)
                          : !!i.equipment[r.id],
                    );
                    return (
                      <div className="card resource-card" key={r.id}>
                        <div className="resource-card-top">
                          <span
                            className={`resource-symbol ${resourceTab === "อุปกรณ์" ? "orange" : "blue"}`}
                          >
                            {resourceTab === "กำลังพล" ? (
                              <Users size={24} />
                            ) : resourceTab === "ยานพาหนะ" ? (
                              <Truck size={24} />
                            ) : (
                              <Package size={24} />
                            )}
                          </span>
                          <Badge text={r.status} />
                        </div>
                        <h3>{r.name}</h3>
                        <p>
                          {r.type}
                          {r.plate && ` · ${r.plate}`}
                        </p>
                        {r.unit && <small>{r.unit}</small>}
                        {r.skills && (
                          <div className="skill-list">
                            {r.skills.map((s) => (
                              <span key={s}>{s}</span>
                            ))}
                          </div>
                        )}
                        {resourceTab === "ยานพาหนะ" && (
                          <div className="resource-details">
                            <span>
                              เชื้อเพลิง <b>{r.fuel ?? "—"}%</b>
                            </span>
                            <span>
                              ความจุน้ำ{" "}
                              <b>{r.water?.toLocaleString() || "—"} ลิตร</b>
                            </span>
                            <span>
                              คนขับ{" "}
                              <b>
                                {store.staff.find((s) => s.id === r.driver)
                                  ?.name || "ยังไม่ระบุ"}
                              </b>
                            </span>
                            <span>
                              เลขไมล์{" "}
                              <b>{r.mileage?.toLocaleString() || "—"}</b>
                            </span>
                          </div>
                        )}
                        {resourceTab === "อุปกรณ์" && (
                          <>
                            <div className="equipment-count">
                              <div>
                                <strong>{r.total}</strong>
                                <small>ทั้งหมด</small>
                              </div>
                              <div>
                                <strong className="green-text">
                                  {r.ready}
                                </strong>
                                <small>พร้อม</small>
                              </div>
                              <div>
                                <strong>
                                  {(r.total || 0) -
                                    (r.ready || 0) -
                                    (r.broken || 0)}
                                </strong>
                                <small>ใช้งาน</small>
                              </div>
                              <div>
                                <strong className="red-text">{r.broken}</strong>
                                <small>ชำรุด</small>
                              </div>
                            </div>
                            <small>
                              ที่เก็บ {r.location} · ตรวจ{" "}
                              {r.checked ? date(r.checked) : "ยังไม่ตรวจ"}
                            </small>
                          </>
                        )}
                        {attached && (
                          <button
                            className="assignment-link"
                            onClick={() => open(attached.id)}
                          >
                            <Radio size={15} />
                            {attached.title}
                            <ChevronRight size={14} />
                          </button>
                        )}
                        <button
                          className="resource-edit"
                          onClick={() =>
                            setEditResource({ kind: resourceTab, resource: r })
                          }
                        >
                          แก้ไขข้อมูล <ChevronRight size={16} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
          {page === "เพิ่มเติม" && (
            <>
              <div className="page-tabs scroll-tabs">
                {[
                  "สถิติและรายงาน",
                  "การแจ้งเตือน",
                  "ประวัติการตรวจสอบ",
                  "การเชื่อมต่อ API",
                  "การตั้งค่า",
                ].map((t) => (
                  <button
                    key={t}
                    className={moreTab === t ? "active" : ""}
                    onClick={() => setMoreTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {moreTab === "สถิติและรายงาน" && (
                <Statistics incidents={incidents} onOpen={open} />
              )}{" "}
              {moreTab === "การแจ้งเตือน" && (
                <section className="card padded">
                  <h2>การแจ้งเตือนจากข้อมูลในระบบ</h2>
                  {urgent.map((i) => (
                    <button
                      className="notification-row"
                      key={i.id}
                      onClick={() => open(i.id)}
                    >
                      <AlertTriangle className="orange-text" />
                      <div>
                        <strong>{i.title}</strong>
                        <p>
                          {i.level} · {i.status} · {i.address}
                        </p>
                      </div>
                      <ChevronRight />
                    </button>
                  ))}
                  {store.equipment
                    .filter((r) => (r.broken || 0) > 0)
                    .map((r) => (
                      <div className="notification-row" key={r.id}>
                        <Package className="red-text" />
                        <div>
                          <strong>
                            {r.name} ชำรุด {r.broken} ชิ้น
                          </strong>
                          <p>
                            ตรวจสอบและจัดเตรียมอุปกรณ์สำรองก่อนออกปฏิบัติการ
                          </p>
                        </div>
                      </div>
                    ))}
                  <LineNotifications live={live} />
                </section>
              )}
              {moreTab === "ประวัติการตรวจสอบ" && (
                <section className="card padded">
                  <h2>
                    <History size={20} />
                    ประวัติการตรวจสอบ
                  </h2>
                  <p className="muted">
                    เวลา ผู้ดำเนินการ และข้อมูลก่อน / หลังเปลี่ยนแปลง
                  </p>
                  {store.audit.length ? (
                    store.audit.map((a) => (
                      <details className="audit-row" key={a.id}>
                        <summary>
                          <span>
                            <strong>{a.action}</strong>
                            <small>
                              {a.actor} · {date(a.at)} {time(a.at)}
                            </small>
                          </span>
                          <ChevronDown size={18} />
                        </summary>
                        <div className="audit-values">
                          <div>
                            <b>ค่าเดิม</b>
                            <pre>{JSON.stringify(a.before, null, 2)}</pre>
                          </div>
                          <div>
                            <b>ค่าใหม่</b>
                            <pre>{JSON.stringify(a.after, null, 2)}</pre>
                          </div>
                        </div>
                      </details>
                    ))
                  ) : (
                    <Empty text="ยังไม่มีการเปลี่ยนแปลงข้อมูลในรอบการใช้งานนี้" />
                  )}
                </section>
              )}
              {moreTab === "การเชื่อมต่อ API" && (
                <div className="resource-grid">
                  <WeatherPanel />
                  {[
                    "Radar ฝน",
                    "ThaiWater",
                    "GISTDA",
                    "Hotspot",
                    "ระบบเตือนภัย",
                    "LINE Messaging API",
                  ].map((name) => (
                    <div className="card padded" key={name}>
                      <span className="resource-symbol blue">
                        <CloudSun size={23} />
                      </span>
                      <h3>{name}</h3>
                      <span className="badge neutral">รอเชื่อม API จริง</span>
                      <p className="muted">ยังไม่มีข้อมูลจากบริการภายนอก</p>
                    </div>
                  ))}
                </div>
              )}
              {moreTab === "การตั้งค่า" && (
                <SettingsPanel
                  store={store}
                  notify={notify}
                  setUser={setSessionUser}
                  role={role}
                  setRole={setRole}
                  install={install}
                  live={live}
                  pending={pending}
                  onRecover={async () => {
                    if (
                      !confirm(
                        "ใช้ข้อมูลล่าสุดจากศูนย์และยกเลิกคำสั่งที่ยังไม่ส่ง? คำสั่งรอส่งจะดาวน์โหลดเป็นไฟล์สำรองก่อน",
                      )
                    )
                      return;
                    const key = "drc-outbox-" + liveUser;
                    const raw = localStorage.getItem(key) || "[]";
                    const u = URL.createObjectURL(
                      new Blob([raw], { type: "application/json" }),
                    );
                    const a = document.createElement("a");
                    a.href = u;
                    a.download = "drc-pending-operations.json";
                    a.click();
                    URL.revokeObjectURL(u);
                    try {
                      const loaded = await loadAgency();
                      localStorage.setItem(key, "[]");
                      setPending(0);
                      setStore(loaded.store);
                      setSyncState("ซิงก์แล้ว");
                      notify(
                        "เปิดข้อมูลล่าสุดจากศูนย์แล้ว สำรองคำสั่งเดิมเรียบร้อย",
                      );
                    } catch (e) {
                      notify("โหลดไม่สำเร็จ คำสั่งรอส่งยังอยู่ในเครื่อง");
                    }
                  }}
                  onLive={enableLive}
                  onSync={() => sync(liveUser)}
                  onDemo={() => {
                    if (pending) {
                      notify(
                        "ยังมีข้อมูลรอส่ง กรุณาซิงก์ให้สำเร็จก่อนออกจากข้อมูลจริง",
                      );
                      return;
                    }
                    authEpoch.current++;
                    localStorage.removeItem("drc-mode");
                    setLive(false);
                    setAgency(defaultAgency.name);
                    setLiveUser("");
                    setStore(
                      JSON.parse(localStorage.getItem(STORE_KEY) || "null") ||
                        seed(),
                    );
                    setSessionUser("");
                    setRole("หัวหน้าศูนย์");
                  }}
                />
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <ShieldPlus size={14} /> ศูนย์บริหารจัดการเหตุสาธารณภัย
            </span>
            <span>
              {live
                ? `${syncState} · รอส่ง ${pending} รายการ`
                : "ข้อมูลตัวอย่าง · บันทึกในอุปกรณ์นี้"}
            </span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav">
        {nav.map((n) => (
          <button
            key={n.label}
            className={page === n.label ? "active" : ""}
            onClick={() => go(n.label)}
          >
            <n.icon size={21} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      <button className="fab" onClick={() => setCreate(true)}>
        <Plus size={23} />
        แจ้งเหตุ
      </button>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          {toast}
          <button aria-label="ปิดข้อความ" onClick={() => setToast("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {notifications && (
        <div className="notifications-pop">
          <div className="card-heading">
            <h2>การแจ้งเตือน</h2>
            <button
              aria-label="ปิดการแจ้งเตือน"
              className="icon-button"
              onClick={() => setNotifications(false)}
            >
              <X size={19} />
            </button>
          </div>
          {urgent.map((i) => (
            <button
              className="notification-row"
              key={i.id}
              onClick={() => {
                open(i.id);
                setNotifications(false);
              }}
            >
              <AlertTriangle size={20} />
              <div>
                <strong>{i.title}</strong>
                <small>
                  {i.level} · {i.status}
                </small>
              </div>
            </button>
          ))}
          <button
            className="resource-link"
            onClick={() => {
              go("เพิ่มเติม");
              setMoreTab("การแจ้งเตือน");
              setNotifications(false);
            }}
          >
            ดูการแจ้งเตือนทั้งหมด
          </button>
        </div>
      )}
      {create && (
        <IncidentForm
          onClose={() => setCreate(false)}
          notify={notify}
          onSave={(i) => {
            i.demo = !live;
            const saved = mutate(
              { ...store, incidents: [i, ...store.incidents] },
              "รับแจ้งเหตุ",
              null,
              i,
              i.id,
            );
            if (saved) {
              setCreate(false);
              open(i.id);
              notify("รับแจ้งเหตุแล้ว ข้อมูลบันทึกในเครื่อง");
            }
            return saved;
          }}
          actor={actor}
        />
      )}
      {current && (
        <Dialog
          onClose={() => setSelected(null)}
          wide
          title={current.title}
          subtitle={current.number}
        >
          <div className="detail-head">
            <Badge text={current.level} />
            <Badge text={current.status} />
            {current.demo && <span className="demo-label">ข้อมูลตัวอย่าง</span>}
          </div>
          <div className="incident-location">
            <MapPin size={18} />
            {current.address}
            <a
              target="_blank"
              rel="noreferrer"
              href={`https://www.openstreetmap.org/?mlat=${current.lat}&mlon=${current.lng}#map=17/${current.lat}/${current.lng}`}
              aria-label="เปิดตำแหน่งในแผนที่"
            >
              <ExternalLink size={17} />
            </a>
          </div>
          {active(current) && (
            <button
              className="primary next-status"
              onClick={() => advance(current)}
            >
              <CheckCircle2 size={21} />
              {
                (
                  {
                    รับแจ้ง: "ตรวจสอบเหตุ",
                    ตรวจสอบ: "จัดกำลัง",
                    จัดกำลัง: "ออกปฏิบัติการ",
                    ออกปฏิบัติการ: "ถึงที่เกิดเหตุ",
                    ถึงเหตุ: "เริ่มดำเนินการ",
                    ดำเนินการ: "ควบคุมเหตุได้",
                    ควบคุมเหตุได้: "ปิดเหตุ",
                  } as Record<string, string>
                )[current.status]
              }
              <span>บันทึกเวลาและผู้ดำเนินการอัตโนมัติ</span>
            </button>
          )}
          <div className="page-tabs detail-tabs">
            {[
              "ข้อมูลเหตุ",
              "จัดกำลัง",
              "Checklist",
              "ภาพหน้างาน",
              "รายงาน",
            ].map((t) => (
              <button
                key={t}
                className={detailTab === t ? "active" : ""}
                onClick={() => setDetailTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="detail-content">
            {detailTab === "ข้อมูลเหตุ" && (
              <>
                <div className="detail-info-grid">
                  <div>
                    <small>ประเภทเหตุ</small>
                    <strong>{current.type}</strong>
                  </div>
                  <div>
                    <small>วันเวลารับแจ้ง</small>
                    <strong>
                      {date(current.reportedAt)} {time(current.reportedAt)} น.
                    </strong>
                  </div>
                  <div>
                    <small>ผู้แจ้ง / ช่องทาง</small>
                    <strong>
                      {current.reporter || "ไม่ระบุ"} · {current.channel}
                    </strong>
                  </div>
                  <div>
                    <small>เบอร์โทรศัพท์</small>
                    <strong>{current.phone || "ไม่ระบุ"}</strong>
                  </div>
                </div>
                <h3>รายละเอียดเหตุ</h3>
                <p>{current.description || "ยังไม่ระบุรายละเอียด"}</p>
                <div className="impact-grid">
                  <div>
                    <strong>{current.injured}</strong>ผู้บาดเจ็บ
                  </div>
                  <div>
                    <strong>{current.dead}</strong>ผู้เสียชีวิต
                  </div>
                  <div>
                    <strong>{current.trapped}</strong>คนติดอยู่
                  </div>
                </div>
                {current.risks.length > 0 && (
                  <div className="info-box warning">
                    <AlertTriangle size={18} />
                    {current.risks.join(" · ")}
                  </div>
                )}
                <h3>
                  <History size={18} />
                  ลำดับเหตุการณ์
                </h3>
                <div className="timeline">
                  {current.timeline.map((t, n) => (
                    <div
                      key={t.id}
                      className={
                        n === current.timeline.length - 1 ? "last" : ""
                      }
                    >
                      <span className="timeline-time">{time(t.at)}</span>
                      <i />
                      <div>
                        <strong>{t.to}</strong>
                        <small>
                          {t.actor} · {date(t.at)}
                        </small>
                        {t.from && (
                          <small>
                            {t.from} → {t.to}
                          </small>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {active(current) && (
                  <button
                    className="danger-outline"
                    onClick={() => {
                      const reason = prompt("ระบุเหตุผลการยกเลิกเหตุ");
                      if (!reason?.trim()) return;
                      const canceled = {
                        ...current,
                        status: "ยกเลิก",
                        problems: reason,
                        version: current.version + 1,
                        timeline: [
                          ...current.timeline,
                          {
                            id: uid(),
                            at: new Date().toISOString(),
                            actor,
                            from: current.status,
                            to: "ยกเลิก",
                            note: reason,
                          },
                        ],
                      };
                      mutate(
                        {
                          ...store,
                          incidents: store.incidents.map((i) =>
                            i.id === current.id ? canceled : i,
                          ),
                          staff: store.staff.map((r) =>
                            current.staff.includes(r.id)
                              ? { ...r, status: "พร้อม" }
                              : r,
                          ),
                          vehicles: store.vehicles.map((r) =>
                            current.vehicles.includes(r.id)
                              ? { ...r, status: "พร้อม" }
                              : r,
                          ),
                          equipment: store.equipment.map((r) =>
                            current.equipment[r.id]
                              ? {
                                  ...r,
                                  ready:
                                    (r.ready || 0) + current.equipment[r.id],
                                }
                              : r,
                          ),
                        },
                        "ยกเลิกเหตุ",
                        current,
                        canceled,
                        current.id,
                      );
                      notify("ยกเลิกเหตุและคืนทรัพยากรแล้ว");
                    }}
                  >
                    ยกเลิกเหตุพร้อมระบุเหตุผล
                  </button>
                )}
              </>
            )}
            {detailTab === "จัดกำลัง" && (
              <>
                <p className="muted">
                  เลือกเพื่อมอบหมายทันที ระบบจองทรัพยากรและบันทึกประวัติ
                </p>
                {(["staff", "vehicles", "equipment"] as const).map((kind) => (
                  <section className="assign-section" key={kind}>
                    <h3>
                      {kind === "staff"
                        ? "เจ้าหน้าที่"
                        : kind === "vehicles"
                          ? "ยานพาหนะ"
                          : "อุปกรณ์"}
                    </h3>
                    {store[kind].map((r) => {
                      const assigned =
                        kind === "equipment"
                          ? !!current.equipment[r.id]
                          : current[kind].includes(r.id);
                      const disabled =
                        !active(current) ||
                        (!assigned &&
                          (kind === "equipment"
                            ? (r.ready || 0) < 1
                            : r.status !== "พร้อม"));
                      return (
                        <div
                          className={`assign-item ${assigned ? "selected" : ""}`}
                          key={r.id}
                        >
                          <button
                            disabled={disabled}
                            onClick={() => assign(current, kind, r.id)}
                          >
                            <span className="checkbox">
                              {assigned && <Check size={16} />}
                            </span>
                            <div>
                              <strong>{r.name}</strong>
                              <small>
                                {kind === "equipment"
                                  ? `พร้อม ${r.ready} / ทั้งหมด ${r.total}`
                                  : r.type}
                              </small>
                            </div>
                            <Badge text={assigned ? "มอบหมายแล้ว" : r.status} />
                          </button>
                          {kind === "equipment" && assigned && (
                            <label className="quantity">
                              จำนวน
                              <input
                                type="number"
                                min={1}
                                max={(r.ready || 0) + current.equipment[r.id]}
                                value={current.equipment[r.id]}
                                disabled={!active(current)}
                                onChange={(e) => {
                                  const count = Number(e.target.value);
                                  if (
                                    !Number.isInteger(count) ||
                                    count < 1 ||
                                    count >
                                      (r.ready || 0) + current.equipment[r.id]
                                  )
                                    return;
                                  const prev = current.equipment[r.id];
                                  const nextI = {
                                    ...current,
                                    equipment: {
                                      ...current.equipment,
                                      [r.id]: count,
                                    },
                                    version: current.version + 1,
                                  };
                                  mutate(
                                    {
                                      ...store,
                                      equipment: store.equipment.map((x) =>
                                        x.id === r.id
                                          ? {
                                              ...x,
                                              ready:
                                                (x.ready || 0) + prev - count,
                                            }
                                          : x,
                                      ),
                                      incidents: store.incidents.map((x) =>
                                        x.id === current.id ? nextI : x,
                                      ),
                                    },
                                    "เปลี่ยนจำนวนอุปกรณ์",
                                    prev,
                                    count,
                                    current.id,
                                  );
                                }}
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </section>
                ))}
              </>
            )}
            {detailTab === "Checklist" && (
              <>
                <div className="check-progress">
                  <ClipboardCheck size={23} />
                  <div>
                    <strong>ตรวจความพร้อมก่อนออกปฏิบัติการ</strong>
                    <small>
                      ตรวจแล้ว{" "}
                      {
                        current.checks.filter((c) =>
                          checklistLabels(current).includes(c),
                        ).length
                      }{" "}
                      / {checklistLabels(current).length} รายการ
                    </small>
                  </div>
                </div>
                {checklistLabels(current).map((c) => (
                  <button
                    disabled={!active(current)}
                    className={`checklist-row ${current.checks.includes(c) ? "checked" : ""}`}
                    key={c}
                    onClick={() =>
                      update(
                        {
                          ...current,
                          checks: current.checks.includes(c)
                            ? current.checks.filter((x) => x !== c)
                            : [...current.checks, c],
                        },
                        "ตรวจ Checklist",
                      )
                    }
                  >
                    <span className="checkbox">
                      {current.checks.includes(c) && <Check size={17} />}
                    </span>
                    {c}
                  </button>
                ))}
              </>
            )}
            {detailTab === "ภาพหน้างาน" && (
              <>
                <div className="photo-phases">
                  {["ก่อนดำเนินการ", "ระหว่างดำเนินการ", "หลังดำเนินการ"].map(
                    (p) => (
                      <button
                        key={p}
                        className={photoPhase === p ? "active" : ""}
                        onClick={() => setPhotoPhase(p)}
                      >
                        {p}
                        <span>
                          {current.photos.filter((ph) => ph.phase === p).length}
                        </span>
                      </button>
                    ),
                  )}
                </div>
                {active(current) && (
                  <label className="upload-box">
                    <Camera size={28} />
                    <strong>ถ่ายภาพหรือเลือกจากอุปกรณ์</strong>
                    <small>เก็บวันเวลา ผู้บันทึก พิกัด และคำอธิบาย</small>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        try {
                          const photos: Photo[] = [];
                          for (const file of files) {
                            if (file.size > 15 * 1024 * 1024) {
                              notify("ภาพต้องมีขนาดไม่เกิน 15 MB");
                              continue;
                            }
                            const id = uid();
                            await putPhoto(id, file);
                            let gps: { lat?: number; lng?: number } = {};
                            if (navigator.geolocation) {
                              gps = await new Promise((resolve) =>
                                navigator.geolocation.getCurrentPosition(
                                  (p) =>
                                    resolve({
                                      lat: p.coords.latitude,
                                      lng: p.coords.longitude,
                                    }),
                                  () => resolve({}),
                                  { timeout: 4000 },
                                ),
                              );
                            }
                            photos.push({
                              id,
                              phase: photoPhase,
                              url: "",
                              at: new Date().toISOString(),
                              actor,
                              ...gps,
                              description: file.name,
                            });
                          }
                          update(
                            {
                              ...current,
                              photos: [...current.photos, ...photos],
                            },
                            "เพิ่มภาพหน้างาน",
                          );
                          notify(`บันทึกภาพ ${photos.length} ภาพแล้ว`);
                        } catch {
                          notify("บันทึกภาพไม่สำเร็จ กรุณาตรวจพื้นที่จัดเก็บ");
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                <div className="photo-grid">
                  {current.photos
                    .filter((p) => p.phase === photoPhase)
                    .map((p) => (
                      <PhotoCard
                        key={p.id}
                        photo={p}
                        disabled={!active(current)}
                        onDescription={(description) =>
                          update(
                            {
                              ...current,
                              photos: current.photos.map((ph) =>
                                ph.id === p.id ? { ...ph, description } : ph,
                              ),
                            },
                            "แก้คำอธิบายภาพ",
                          )
                        }
                      />
                    ))}
                </div>
                {!current.photos.some((p) => p.phase === photoPhase) && (
                  <Empty text={`ยังไม่มีภาพ${photoPhase}`} />
                )}
              </>
            )}
            {detailTab === "รายงาน" && (
              <>
                <form
                  className="report-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    update(
                      {
                        ...current,
                        result: String(f.get("result")),
                        damage: String(f.get("damage")),
                        problems: String(f.get("problems")),
                        commander: String(f.get("commander")),
                      },
                      "บันทึกผลการดำเนินงาน",
                    );
                    notify("บันทึกข้อมูลรายงานแล้ว");
                  }}
                >
                  <label>
                    การดำเนินงานและผลลัพธ์ *
                    <textarea
                      name="result"
                      defaultValue={current.result}
                      required
                      rows={3}
                      disabled={!active(current)}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      ความเสียหาย
                      <textarea
                        name="damage"
                        defaultValue={current.damage}
                        rows={2}
                        disabled={!active(current)}
                      />
                    </label>
                    <label>
                      ปัญหาและข้อเสนอแนะ
                      <textarea
                        name="problems"
                        defaultValue={current.problems}
                        rows={2}
                        disabled={!active(current)}
                      />
                    </label>
                  </div>
                  <label>
                    ผู้ควบคุมเหตุ *
                    <input
                      name="commander"
                      defaultValue={current.commander}
                      required
                      placeholder="ชื่อและตำแหน่งผู้ควบคุมเหตุ"
                      disabled={!active(current)}
                    />
                  </label>
                  {active(current) && (
                    <button className="secondary" type="submit">
                      <Save size={18} />
                      บันทึกผลการดำเนินงาน
                    </button>
                  )}
                </form>
                <div className="report-actions">
                  <button
                    className="secondary"
                    onClick={() => printReport(current, store, notify)}
                  >
                    <Eye size={18} />
                    ดูรายงาน / พิมพ์ / PDF
                  </button>
                  <button
                    className="secondary"
                    onClick={async () => {
                      const text = `รายงานเหตุ ${current.number}\n${current.title}\n${current.address}\nสถานะ ${current.status}\n${current.result}`;
                      try {
                        if (navigator.share)
                          await navigator.share({
                            title: `รายงาน ${current.number}`,
                            text,
                          });
                        else {
                          await navigator.clipboard.writeText(text);
                          notify("คัดลอกสรุปรายงานแล้ว");
                        }
                      } catch {
                        notify("ไม่สามารถแชร์ได้ กรุณาใช้รายงาน PDF");
                      }
                    }}
                  >
                    <Share2 size={18} />
                    แชร์สรุปรายงาน
                  </button>
                </div>
                <div className="info-box">
                  <FileText size={20} />
                  เลือก “บันทึกเป็น PDF” ในหน้าต่างพิมพ์
                  รายงานใช้ฟอนต์ภาษาไทยและรวมภาพหน้างาน
                </div>
              </>
            )}
          </div>
        </Dialog>
      )}
      {editResource && (
        <ResourceForm
          kind={editResource.kind}
          resource={editResource.resource}
          staff={store.staff}
          onClose={() => setEditResource(null)}
          onSave={(r) => {
            const kind =
              editResource.kind === "กำลังพล"
                ? "staff"
                : editResource.kind === "ยานพาหนะ"
                  ? "vehicles"
                  : "equipment";
            const old = store[kind].find((x) => x.id === r.id);
            const attached = ongoing.some((i) =>
              kind === "staff"
                ? i.staff.includes(r.id)
                : kind === "vehicles"
                  ? i.vehicles.includes(r.id)
                  : !!i.equipment[r.id],
            );
            if (attached && r.status !== "ปฏิบัติงาน" && kind !== "equipment") {
              notify(
                "ทรัพยากรนี้ยังถูกมอบหมายอยู่ กรุณาถอนจากเหตุก่อนเปลี่ยนสถานะ",
              );
              return;
            }
            if (
              kind === "equipment" &&
              attached &&
              ((r.ready || 0) !== (old?.ready || 0) ||
                (r.total || 0) !== (old?.total || 0) ||
                (r.broken || 0) !== (old?.broken || 0))
            ) {
              notify("อุปกรณ์กำลังถูกใช้งาน กรุณาถอนจากเหตุก่อนปรับจำนวน");
              return;
            }
            if (
              mutate(
                {
                  ...store,
                  [kind]: old
                    ? store[kind].map((x) => (x.id === r.id ? r : x))
                    : [...store[kind], r],
                },
                old ? "แก้ไขทรัพยากร" : "เพิ่มทรัพยากร",
                old,
                r,
              )
            ) {
              setEditResource(null);
              notify("บันทึกทรัพยากรแล้ว");
            }
          }}
        />
      )}
    </div>
  );
}
