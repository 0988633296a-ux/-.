import { seed, type Store } from "./model";
import { defaultAgency } from "./agency";
const oldAddresses: Record<string, string> = {
  "demo-1": "ถนนเชียงใหม่–พร้าว ม.3 ต.หนองหาร",
  "demo-2": "บริเวณหลังตลาด ม.6 ต.หนองหาร",
  "demo-3": "บ้านแม่เตาไห ม.1 ต.หนองหาร",
  "demo-4": "แยกหน้ามหาวิทยาลัยแม่โจ้ ต.หนองหาร",
  "demo-5": "บ้านสหกรณ์ ม.4 ต.หนองหาร",
};
/** ปรับเฉพาะจุดตัวอย่างเดิม โดยรักษาเหตุที่ผู้ใช้สร้าง สถานะ ภาพ และประวัติทั้งหมด */
export function localizeDemoStore(store: Store): Store {
  const examples = seed().incidents;
  return {
    ...store,
    incidents: store.incidents.map((i) => {
      const example = examples.find((e) => e.id === i.id);
      return i.demo && example && i.address === oldAddresses[i.id]
        ? {
            ...i,
            address: example.address,
            area: defaultAgency.area,
            lat: example.lat,
            lng: example.lng,
          }
        : i;
    }),
    staff: store.staff.map((s) =>
      /^s\d+$/.test(s.id) && s.unit === "ศูนย์ ปภ. หนองหาร" ? { ...s, unit: defaultAgency.name } : s,
    ),
    vehicles: store.vehicles.map((v) =>
      /^v[1-7]$/.test(v.id) && v.plate?.endsWith("เชียงใหม่")
        ? { ...v, plate: v.plate.replace("เชียงใหม่", "กาฬสินธุ์") }
        : v,
    ),
  };
}
