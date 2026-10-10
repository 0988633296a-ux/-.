import type { Incident, Photo, Resource, Store } from "./model";
import { uid } from "./model";
import { client, getPhoto } from "./persistence";
export type Operation = {
  id: string;
  kind: string;
  before: any;
  after: any;
  incidentId?: string;
  userId: string;
  at: string;
  expectedVersion?: number;
  resourceKind?: string;
};
export const queueKey = (user: string) => `drc-outbox-${user}`;
export function queueOperation(op: Omit<Operation, "id" | "at">) {
  const key = queueKey(op.userId);
  const q: Operation[] = JSON.parse(localStorage.getItem(key) || "[]");
  q.push({ ...op, id: uid(), at: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(q));
}
export function pendingCount(user: string) {
  return JSON.parse(localStorage.getItem(queueKey(user)) || "[]").length;
}
const api = () => {
  const c = client();
  if (!c) throw Error("ยังไม่ได้เชื่อม Supabase");
  return c;
};
async function rpc(name: string, args: any) {
  const { data, error } = await api().rpc(name, args);
  if (error) throw Error(error.message);
  return data;
}
export async function loadAgency(): Promise<{
  store: Store;
  userId: string;
  name: string;
  role: string;
  agency: string;
}> {
  const c = api();
  const {
    data: { user },
  } = await c.auth.getUser();
  if (!user) throw Error("กรุณาเข้าสู่ระบบ");
  const { data: profile, error: pe } = await c
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();
  if (pe || !profile)
    throw Error(
      "บัญชีนี้ยังไม่มีสิทธิ์หน่วยงาน กรุณาติดต่อผู้ดูแลศูนย์",
    );
  const { data: organization } = await c
    .from("organizations")
    .select("name")
    .eq("id", profile.organization_id)
    .single();
  const names = [
    "incidents",
    "staff",
    "vehicles",
    "equipment",
    "incident_timeline",
    "incident_staff",
    "incident_vehicles",
    "incident_equipment",
    "incident_photos",
    "incident_checklist_items",
    "staff_skills",
    "skills",
    "audit_logs",
    "locations",
    "risk_locations",
  ];
  const response = await Promise.all(
    names.map(async (name) => {
      const { data, error } = await c.from(name).select("*");
      if (error) throw Error(error.message);
      return [name, data || []] as const;
    }),
  );
  const tables = Object.fromEntries(response);
  const staff = tables.staff.map((s: any): Resource => ({
    id: s.id,
    name: s.name,
    type: s.position,
    status: s.status,
    phone: s.phone,
    unit: s.unit,
    skills: tables.staff_skills
      .filter((a: any) => a.staff_id === s.id)
      .map(
        (a: any) =>
          tables.skills.find((sk: any) => sk.id === a.skill_id)?.name || "",
      ),
  }));
  const vehicles = tables.vehicles.map((v: any): Resource => ({
    id: v.id,
    name: v.name,
    type: v.type,
    status: v.status,
    plate: v.plate,
    water: v.water,
    driver: v.driver_id,
    mileage: v.mileage,
    fuel: v.fuel,
    notes: v.notes,
  }));
  const equipment = tables.equipment.map((e: any): Resource => ({
    id: e.id,
    name: e.name,
    type: e.type,
    total: e.total,
    broken: e.broken,
    ready:
      e.total -
      e.broken -
      tables.incident_equipment
        .filter((a: any) => a.equipment_id === e.id && !a.released_at)
        .reduce((sum: number, a: any) => sum + a.quantity, 0),
    status: e.total > e.broken ? "พร้อม" : "ไม่พร้อม",
    location: e.location,
    checked: e.checked_at,
    notes: e.notes,
  }));
  const photos = await Promise.all(
    tables.incident_photos
      .filter((p: any) => !p.deleted_at)
      .map(async (p: any) => {
        const { data } = await c.storage
          .from("incident-photos")
          .createSignedUrl(p.storage_path, 3600);
        return { ...p, url: data?.signedUrl || "" };
      }),
  );
  const incidents = tables.incidents.map((i: any): Incident => ({
    id: i.id,
    number: i.number,
    type: i.type,
    title: i.title,
    address: i.address,
    area: i.area || "",
    lat: i.lat,
    lng: i.lng,
    level: i.level,
    status: i.status,
    reportedAt: i.reported_at,
    reporter: i.reporter || "",
    phone: i.phone || "",
    channel: i.channel,
    description: i.description || "",
    injured: i.injured,
    dead: i.dead,
    trapped: i.trapped,
    risks: i.risks || [],
    staff: tables.incident_staff
      .filter(
        (a: any) =>
          a.incident_id === i.id &&
          (!a.released_at || ["เสร็จสิ้น", "ยกเลิก"].includes(i.status)),
      )
      .map((a: any) => a.staff_id),
    vehicles: tables.incident_vehicles
      .filter(
        (a: any) =>
          a.incident_id === i.id &&
          (!a.released_at || ["เสร็จสิ้น", "ยกเลิก"].includes(i.status)),
      )
      .map((a: any) => a.vehicle_id),
    equipment: Object.fromEntries(
      tables.incident_equipment
        .filter(
          (a: any) =>
            a.incident_id === i.id &&
            (!a.released_at || ["เสร็จสิ้น", "ยกเลิก"].includes(i.status)),
        )
        .map((a: any) => [a.equipment_id, a.quantity]),
    ),
    checkItems: tables.incident_checklist_items
      .filter((c: any) => c.incident_id === i.id)
      .map((c: any) => ({ label: c.label, required: c.required })),
    checks: tables.incident_checklist_items
      .filter((a: any) => a.incident_id === i.id && a.checked)
      .map((a: any) => a.label),
    timeline: tables.incident_timeline
      .filter((t: any) => t.incident_id === i.id)
      .sort((a: any, b: any) => a.at.localeCompare(b.at))
      .map((t: any) => ({
        id: t.id,
        at: t.at,
        actor: t.actor_id === user.id ? profile.name : t.actor_id,
        from: t.from_status || "",
        to: t.to_status,
        note: t.note,
      })),
    photos: photos
      .filter((p: any) => p.incident_id === i.id)
      .map((p: any) => ({
        id: p.id,
        phase: p.phase,
        url: p.url,
        at: p.at,
        actor: p.actor_id === user.id ? profile.name : p.actor_id,
        lat: p.lat,
        lng: p.lng,
        description: p.description || "",
      })),
    result: i.result || "",
    damage: i.damage || "",
    problems: i.problems || "",
    commander: i.commander_name || "",
    version: i.version,
    demo: false,
  }));
  return {
    store: {
      locations: tables.locations.map((l: any) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        lat: l.lat,
        lng: l.lng,
        address: l.address,
        risk: tables.risk_locations.find(
          (r: any) => r.location_id === l.id && !r.deleted_at,
        )?.risk_type,
      })),
      incidents,
      staff,
      vehicles,
      equipment,
      audit: tables.audit_logs.map((a: any) => ({
        id: a.id,
        at: a.at,
        actor: a.actor_id === user.id ? profile.name : a.actor_id,
        action: `${a.action} ${a.entity}`,
        before: a.old_value,
        after: a.new_value,
      })),
    },
    userId: user.id,
    name: profile.name,
    agency: organization?.name || "ศูนย์ปฏิบัติการ",
    role: (
      {
        administrator: "Administrator",
        center_lead: "หัวหน้าศูนย์",
        dispatcher: "เจ้าหน้าที่รับแจ้ง",
        field_staff: "เจ้าหน้าที่ภาคสนาม",
        report_viewer: "ผู้ดูรายงาน",
      } as any
    )[profile.role],
  };
}
async function uploadPhotos(op: Operation, photos: Photo[]) {
  const c = api();
  const { data: profile, error } = await c
    .from("users")
    .select("organization_id")
    .eq("id", op.userId)
    .single();
  if (error) throw error;
  const rows = [];
  for (const p of photos) {
    const blob = await getPhoto(p.id);
    if (!blob) throw Error("ไม่พบไฟล์ภาพในเครื่อง กรุณาเก็บภาพนี้อีกครั้ง");
    const path = `${profile.organization_id}/${op.incidentId || op.after.id}/${p.id}`;
    const { error: up } = await c.storage
      .from("incident-photos")
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (
      up &&
      !up.message.includes("already exists") &&
      !up.message.includes("Duplicate")
    )
      throw up;
    rows.push({
      id: p.id,
      phase: p.phase,
      storage_path: path,
      at: p.at,
      lat: p.lat,
      lng: p.lng,
      description: p.description,
    });
  }
  return rows;
}
async function flushQueue(userId: string, onProgress: (count: number) => void) {
  const c = api();
  const {
    data: { user },
  } = await c.auth.getUser();
  if (user?.id !== userId)
    throw Error("บัญชีที่เข้าสู่ระบบไม่ตรงกับเจ้าของข้อมูลรอส่ง");
  const key = queueKey(userId);
  while (navigator.onLine) {
    const q: Operation[] = JSON.parse(localStorage.getItem(key) || "[]");
    if (!q.length) return;
    const op = q[0];
    const before = op.before,
      after = op.after;
    const kind = op.kind;
    if (kind === "รับแจ้งเหตุ") {
      await rpc("create_incident", { p_operation: op.id, p_data: after });
      if (after.photos?.length) {
        const rows = await uploadPhotos(op, after.photos);
        await rpc("attach_incident_photos", {
          p_operation: op.id,
          p_incident: after.id,
          p_photos: rows,
          p_bump: false,
        });
      }
    } else if (kind === "เปลี่ยนสถานะ" || kind === "ยกเลิกเหตุ") {
      await rpc("transition_incident", {
        p_operation: op.id,
        p_incident: op.incidentId,
        p_expected_version: op.expectedVersion ?? before?.version,
        p_to: typeof after === "string" ? after : after.status,
        p_note: after?.problems || null,
      });
    } else if (
      ["มอบหมายทรัพยากร", "ถอนการมอบหมาย", "เปลี่ยนจำนวนอุปกรณ์"].includes(kind)
    ) {
      for (const key of ["staff", "vehicles", "equipment"] as const) {
        const old =
          key === "equipment"
            ? before.equipment
            : Object.fromEntries(before[key].map((id: string) => [id, 1]));
        const next =
          key === "equipment"
            ? after.equipment
            : Object.fromEntries(after[key].map((id: string) => [id, 1]));
        const changed = [
          ...new Set([...Object.keys(old), ...Object.keys(next)]),
        ].find((id) => old[id] !== next[id]);
        if (changed) {
          await rpc("assign_resource", {
            p_operation: op.id,
            p_incident: op.incidentId,
            p_kind: key,
            p_resource: changed,
            p_quantity: next[changed] || 1,
            p_release: !next[changed],
            p_expected_version: before.version,
          });
          break;
        }
      }
    } else if (kind === "ตรวจ Checklist") {
      const label = [...new Set([...before.checks, ...after.checks])].find(
        (s: string) => before.checks.includes(s) !== after.checks.includes(s),
      );
      await rpc("set_incident_check", {
        p_operation: op.id,
        p_incident: after.id,
        p_label: label,
        p_checked: after.checks.includes(label),
        p_expected_version: before.version,
      });
    } else if (kind === "บันทึกผลการดำเนินงาน") {
      await rpc("save_incident_result", {
        p_operation: op.id,
        p_incident: after.id,
        p_expected_version: before.version,
        p_result: after.result,
        p_damage: after.damage,
        p_problems: after.problems,
        p_commander: after.commander,
      });
    } else if (kind === "เพิ่มภาพหน้างาน") {
      const rows = await uploadPhotos(
        op,
        after.photos.filter(
          (p: Photo) => !before.photos.some((p0: Photo) => p0.id === p.id),
        ),
      );
      await rpc("attach_incident_photos", {
        p_operation: op.id,
        p_incident: after.id,
        p_photos: rows,
        p_bump: true,
        p_expected_version: before.version,
      });
    } else if (kind === "แก้คำอธิบายภาพ") {
      const p = after.photos.find(
        (p: Photo) =>
          before.photos.find((p0: Photo) => p0.id === p.id)?.description !==
          p.description,
      );
      await rpc("update_photo_description", {
        p_operation: op.id,
        p_incident: after.id,
        p_photo: p.id,
        p_description: p.description,
        p_expected_version: before.version,
      });
    } else if (kind === "เพิ่มทรัพยากร" || kind === "แก้ไขทรัพยากร") {
      await rpc("save_resource", {
        p_operation: op.id,
        p_kind: op.resourceKind,
        p_data: after,
      });
    } else throw Error("คำสั่งนี้ยังไม่รองรับในระบบจริง");
    const remaining: Operation[] = JSON.parse(
      localStorage.getItem(key) || "[]",
    );
    localStorage.setItem(
      key,
      JSON.stringify(remaining.filter((x) => x.id !== op.id)),
    );
    onProgress(remaining.length - 1);
  }
}

let running: Promise<void> | null = null;
export async function flushOperations(
  userId: string,
  onProgress: (count: number) => void,
) {
  if (running) return running;
  running = flushQueue(userId, onProgress);
  try {
    await running;
  } finally {
    running = null;
  }
}
