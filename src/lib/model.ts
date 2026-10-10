import { defaultAgency } from "./agency";
export const statuses = [
  "รับแจ้ง",
  "ตรวจสอบ",
  "จัดกำลัง",
  "ออกปฏิบัติการ",
  "ถึงเหตุ",
  "ดำเนินการ",
  "ควบคุมเหตุได้",
  "เสร็จสิ้น",
  "ยกเลิก",
] as const;
export const types = [
  "ต้นไม้ล้ม",
  "ไฟไหม้",
  "ไฟไหม้หญ้า",
  "ไฟป่า",
  "น้ำท่วม",
  "วาตภัย",
  "อุบัติเหตุ",
  "อาคารถล่ม",
  "ดินถล่ม",
  "สารเคมี",
  "จับสัตว์",
  "ค้นหาบุคคล",
  "ไฟฟ้า",
  "ภัยแล้ง",
  "ประชาชนขอความช่วยเหลือ",
];
export const levels = ["ทั่วไป", "เฝ้าระวัง", "เร่งด่วน", "วิกฤต"];
export type Timeline = {
  id: string;
  at: string;
  actor: string;
  from: string;
  to: string;
  note?: string;
};
export type Photo = {
  id: string;
  phase: string;
  url: string;
  at: string;
  actor: string;
  lat?: number;
  lng?: number;
  description: string;
};
export type Incident = {
  id: string;
  number: string;
  type: string;
  title: string;
  address: string;
  area: string;
  lat: number;
  lng: number;
  level: string;
  status: string;
  reportedAt: string;
  reporter: string;
  phone: string;
  channel: string;
  description: string;
  injured: number;
  dead: number;
  trapped: number;
  risks: string[];
  staff: string[];
  vehicles: string[];
  equipment: Record<string, number>;
  checks: string[];
  checkItems?: { label: string; required: boolean }[];
  timeline: Timeline[];
  photos: Photo[];
  result: string;
  damage: string;
  problems: string;
  commander: string;
  version: number;
  deletedAt?: string;
  demo: boolean;
};
export type Resource = {
  id: string;
  name: string;
  type: string;
  status: string;
  phone?: string;
  unit?: string;
  skills?: string[];
  plate?: string;
  water?: number;
  driver?: string;
  mileage?: number;
  fuel?: number;
  total?: number;
  ready?: number;
  broken?: number;
  location?: string;
  checked?: string;
  notes?: string;
};
export type Audit = {
  id: string;
  at: string;
  actor: string;
  action: string;
  incidentId?: string;
  before: unknown;
  after: unknown;
};
export type LocationPoint = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  address?: string;
  risk?: string;
};
export type Store = {
  locations?: LocationPoint[];
  incidents: Incident[];
  staff: Resource[];
  vehicles: Resource[];
  equipment: Resource[];
  audit: Audit[];
};
export const checks = [
  "เจ้าหน้าที่ครบ",
  "รถพร้อม",
  "เชื้อเพลิงเพียงพอ",
  "วิทยุพร้อม",
  "PPE พร้อม",
  "อุปกรณ์ครบ",
  "ทราบพิกัดจุดเกิดเหตุ",
  "ประเมินความเสี่ยงแล้ว",
];
export const uid = () => crypto.randomUUID();
export const time = (d: string) =>
  new Date(d).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
export const date = (d: string) =>
  new Date(d).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
export const active = (i: Incident) =>
  !["เสร็จสิ้น", "ยกเลิก"].includes(i.status) && !i.deletedAt;
export function seed(): Store {
  const day = new Date(
    new Date().toISOString().slice(0, 10) + "T14:32:00+07:00",
  );
  const at = (offset: number) => new Date(+day - offset * 60000).toISOString();
  const incidents = [
    [
      "ต้นไม้ล้ม",
      "ต้นไม้ล้มขวางถนน",
      "ถนนในชุมชน ต.ลำห้วยหลัว (จุดตัวอย่าง)",
      "เร่งด่วน",
      "ดำเนินการ",
      16.702,
      103.739,
      ["s1", "s2"],
      ["v1"],
      { e1: 1 },
      0,
    ],
    [
      "ไฟไหม้หญ้า",
      "ไฟไหม้หญ้าริมทาง",
      "พื้นที่ริมทาง ต.ลำห้วยหลัว (จุดตัวอย่าง)",
      "เร่งด่วน",
      "ออกปฏิบัติการ",
      16.687,
      103.754,
      ["s3", "s4"],
      ["v2"],
      { e2: 2 },
      24,
    ],
    [
      "น้ำท่วม",
      "น้ำท่วมถนนในหมู่บ้าน",
      "ถนนในหมู่บ้าน ต.ลำห้วยหลัว (จุดตัวอย่าง)",
      "เฝ้าระวัง",
      "ตรวจสอบ",
      16.713,
      103.75,
      [],
      [],
      {},
      49,
    ],
    [
      "อุบัติเหตุ",
      "อุบัติเหตุรถจักรยานยนต์",
      "แยกถนนในชุมชน ต.ลำห้วยหลัว (จุดตัวอย่าง)",
      "ทั่วไป",
      "เสร็จสิ้น",
      16.699,
      103.747,
      [],
      [],
      {},
      116,
    ],
    [
      "ประชาชนขอความช่วยเหลือ",
      "ช่วยเหลือผู้ป่วยติดเตียง",
      "บ้านประชาชน ต.ลำห้วยหลัว (จุดตัวอย่าง)",
      "ทั่วไป",
      "เสร็จสิ้น",
      16.681,
      103.735,
      [],
      [],
      {},
      178,
    ],
  ];
  return {
    incidents: incidents.map((r, index) => ({
      id: `demo-${index + 1}`,
      number: `DRC-${day.getFullYear() + 543}-${String(index + 1).padStart(4, "0")}`,
      type: r[0] as string,
      title: r[1] as string,
      address: r[2] as string,
      area: defaultAgency.area,
      level: r[3] as string,
      status: r[4] as string,
      lat: r[5] as number,
      lng: r[6] as number,
      staff: r[7] as string[],
      vehicles: r[8] as string[],
      equipment: r[9] as Record<string, number>,
      reportedAt: at(r[10] as number),
      reporter: "ประชาชนในพื้นที่",
      phone: "",
      channel: "โทรศัพท์",
      description:
        index === 0
          ? "ต้นไม้ขนาดใหญ่ล้มขวางช่องทางจราจร 1 ช่องทาง เจ้าหน้าที่กำลังตัดและเคลื่อนย้าย ขอให้ผู้ใช้เส้นทางหลีกเลี่ยงพื้นที่ปฏิบัติงาน"
          : "รับแจ้งจากประชาชนในพื้นที่ อยู่ระหว่างการตรวจสอบและประสานหน่วยปฏิบัติการ",
      injured: index === 3 ? 1 : 0,
      dead: 0,
      trapped: 0,
      risks: [],
      checks: index < 2 ? [...checks] : [],
      timeline: [
        {
          id: `t-${index}`,
          at: at(r[10] as number),
          actor: "เจ้าหน้าที่รับแจ้ง (ตัวอย่าง)",
          from: "",
          to: "รับแจ้ง",
        },
        ...(index === 0
          ? [
              {
                id: "t-01",
                at: at(-6),
                actor: "สมชาย ใจดี (ตัวอย่าง)",
                from: "จัดกำลัง",
                to: "ออกปฏิบัติการ",
              },
              {
                id: "t-02",
                at: at(-14),
                actor: "สมชาย ใจดี (ตัวอย่าง)",
                from: "ออกปฏิบัติการ",
                to: "ถึงเหตุ",
              },
              {
                id: "t-03",
                at: at(-18),
                actor: "สมชาย ใจดี (ตัวอย่าง)",
                from: "ถึงเหตุ",
                to: "ดำเนินการ",
              },
            ]
          : []),
      ],
      photos: [],
      result:
        index > 2
          ? "ช่วยเหลือประชาชนและส่งต่อหน่วยงานที่เกี่ยวข้องเรียบร้อย"
          : "",
      damage: "",
      problems: "",
      commander: "",
      version: 1,
      demo: true,
    })),
    staff: [
      {
        id: "s1",
        name: "สมชาย ใจดี",
        type: "หัวหน้าชุดปฏิบัติการ",
        status: "ปฏิบัติงาน",
        unit: "ชุดกู้ภัย 01",
        phone: "",
        skills: ["กู้ภัย", "เลื่อยยนต์"],
      },
      {
        id: "s2",
        name: "วิชัย แสงทอง",
        type: "พนักงานขับรถ",
        status: "ปฏิบัติงาน",
        unit: "ชุดกู้ภัย 01",
        skills: ["ขับรถ", "ปฐมพยาบาล"],
      },
      {
        id: "s3",
        name: "อนุชา พรมมา",
        type: "เจ้าหน้าที่ดับเพลิง",
        status: "ปฏิบัติงาน",
        unit: "ชุดดับเพลิง 02",
        skills: ["ดับเพลิง"],
      },
      {
        id: "s4",
        name: "สุรชัย คำเมือง",
        type: "เจ้าหน้าที่ดับเพลิง",
        status: "ปฏิบัติงาน",
        unit: "ชุดดับเพลิง 02",
        skills: ["ดับเพลิง", "ขับรถ"],
      },
      ...[
        "พิมพ์ใจ สุขดี",
        "ธนวัฒน์ ใจกล้า",
        "สิริพร แก้วคำ",
        "ประเสริฐ แสนดี",
        "กิตติพงษ์ มั่นคง",
        "มาลี ศรีคำ",
        "วรพล ใจมั่น",
        "ณัฐวุฒิ คำดี",
      ].map((name, n) => ({
        id: `s${n + 5}`,
        name,
        type: "เจ้าหน้าที่กู้ภัย",
        status: "พร้อม",
        unit: defaultAgency.name,
        skills: ["กู้ภัย", "ปฐมพยาบาล"],
      })),
    ],
    vehicles: [
      {
        id: "v1",
        name: "กู้ภัย 01",
        plate: "บฉ 2451 กาฬสินธุ์",
        type: "รถกู้ภัย",
        status: "ปฏิบัติงาน",
        driver: "s2",
        fuel: 85,
        mileage: 42130,
      },
      {
        id: "v2",
        name: "ดับเพลิง 02",
        plate: "บฉ 6890 กาฬสินธุ์",
        type: "รถดับเพลิง",
        status: "ปฏิบัติงาน",
        water: 6000,
        fuel: 90,
        driver: "s4",
      },
      ...["รถน้ำ 03", "รถกู้ภัย 04", "รถตรวจการณ์ 05", "เรือกู้ภัย 01"].map(
        (name, n) => ({
          id: `v${n + 3}`,
          name,
          type: n === 3 ? "เรือ" : "รถน้ำ",
          plate: n === 3 ? "—" : `บฉ ${3211 + n} กาฬสินธุ์`,
          status: "พร้อม",
          fuel: 90,
        }),
      ),
      {
        id: "v7",
        name: "รถกระเช้า 06",
        type: "รถกระเช้า",
        plate: "บฉ 7211 กาฬสินธุ์",
        status: "ซ่อม",
        fuel: 50,
      },
    ],
    equipment: [
      {
        id: "e1",
        name: "เลื่อยยนต์",
        type: "ตัดและเคลื่อนย้าย",
        status: "พร้อม",
        total: 4,
        ready: 2,
        broken: 1,
        location: "คลัง A",
        checked: at(2000),
      },
      {
        id: "e2",
        name: "สายส่งน้ำ",
        type: "ดับเพลิง",
        status: "พร้อม",
        total: 12,
        ready: 10,
        broken: 0,
        location: "คลัง A",
        checked: at(2000),
      },
      {
        id: "e3",
        name: "เครื่องสูบน้ำ",
        type: "สูบน้ำ",
        status: "พร้อม",
        total: 4,
        ready: 4,
        broken: 0,
        location: "คลัง B",
        checked: at(2000),
      },
      {
        id: "e4",
        name: "วิทยุสื่อสาร",
        type: "สื่อสาร",
        status: "พร้อม",
        total: 16,
        ready: 15,
        broken: 1,
        location: "ศูนย์วิทยุ",
        checked: at(2000),
      },
      {
        id: "e5",
        name: "ชุด PPE",
        type: "ป้องกันส่วนบุคคล",
        status: "พร้อม",
        total: 24,
        ready: 24,
        broken: 0,
        location: "คลัง A",
        checked: at(2000),
      },
      {
        id: "e6",
        name: "เครื่องตัดถ่าง",
        type: "กู้ภัย",
        status: "พร้อม",
        total: 2,
        ready: 2,
        broken: 0,
        location: "คลัง B",
        checked: at(2000),
      },
    ],
    audit: [],
  };
}
