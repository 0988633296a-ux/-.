"use client";
import { defaultAgency } from "@/lib/agency";
import type { Incident, LocationPoint } from "@/lib/model";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
export default function IncidentMap({
  incidents,
  onOpen,
  large = false,
  filter = "ทั้งหมด",
  demo = true,
  locations = [],
}: {
  incidents: Incident[];
  onOpen: (id: string) => void;
  large?: boolean;
  filter?: string;
  demo?: boolean;
  locations?: LocationPoint[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let map: import("leaflet").Map | undefined;
    import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, {
        zoomControl: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
        scrollWheelZoom: large,
      }).setView(
        !demo && incidents.length
          ? [incidents[0].lat, incidents[0].lng]
          : defaultAgency.mapCenter,
        13,
      );
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      incidents
        .filter(
          (i) =>
            !i.deletedAt &&
            (filter === "ทั้งหมด" ||
              (filter === "กำลังดำเนินการ" &&
                !["เสร็จสิ้น", "ยกเลิก", "รับแจ้ง"].includes(i.status)) ||
              (filter === "เหตุใหม่" && i.status === "รับแจ้ง") ||
              (filter === "ปิดแล้ว" && i.status === "เสร็จสิ้น")),
        )
        .forEach((i) => {
          const color =
            i.status === "เสร็จสิ้น"
              ? "#2d9a78"
              : i.level === "วิกฤต"
                ? "#dc414b"
                : i.level === "เร่งด่วน"
                  ? "#eb713b"
                  : "#397ec7";
          const icon = L.divIcon({
            className: "incident-marker",
            html: `<div style="background:${color}"><span>${i.type.includes("ไฟ") ? "♨" : i.type === "น้ำท่วม" ? "≈" : "!"}</span></div>`,
            iconSize: [34, 42],
            iconAnchor: [17, 40],
          });
          const content = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = i.title;
          const p = document.createElement("p");
          p.textContent = `${i.level} · ${i.status}`;
          const b = document.createElement("button");
          b.className = "map-open";
          b.textContent = "ดูรายละเอียดเหตุ";
          b.onclick = () => onOpen(i.id);
          content.append(title, p, b);
          L.marker([i.lat, i.lng], { icon }).addTo(map!).bindPopup(content);
        });
      const poi: [number, number, string, string][] = [
        [
          16.6971878,
          103.7459312,
          "จุดศูนย์ปฏิบัติการ (ตัวอย่าง)",
          "ศูนย์ปฏิบัติการ",
        ],
        [16.708, 103.742, "จุดโรงพยาบาล (ตัวอย่าง)", "โรงพยาบาล"],
        [16.688, 103.733, "แหล่งน้ำสำรอง", "แหล่งน้ำ"],
        [16.705, 103.76, "จุดเฝ้าระวังน้ำท่วม", "พื้นที่เสี่ยง"],
        [16.715, 103.732, "ศูนย์อพยพชุมชน", "ศูนย์อพยพ"],
      ];
      if (demo)
        poi.forEach(([lat, lng, name, type]) => {
          const icon = L.divIcon({
            className: "poi-marker",
            html: "<span>+</span>",
            iconSize: [25, 25],
          });
          const c = document.createElement("div");
          c.textContent = `${name} · ${type} (ข้อมูลตัวอย่าง)`;
          L.marker([lat, lng], { icon }).addTo(map!).bindPopup(c);
        });
      locations.forEach((point) => {
        const content = document.createElement("div");
        content.textContent =
          point.name +
          " · " +
          point.type +
          (point.risk ? " · " + point.risk : "");
        const icon = L.divIcon({
          className: "poi-marker",
          html: "<span>+</span>",
          iconSize: [25, 25],
        });
        L.marker([point.lat, point.lng], { icon })
          .addTo(map!)
          .bindPopup(content);
        if (point.risk)
          L.circle([point.lat, point.lng], {
            radius: 300,
            color: "#e2a334",
            fillOpacity: 0.08,
            weight: 1,
            dashArray: "4 5",
          }).addTo(map!);
      });
      if (demo)
        L.circle([16.705, 103.76], {
          radius: 450,
          color: "#e2a334",
          fillOpacity: 0.08,
          weight: 1,
          dashArray: "4 5",
        }).addTo(map);
      resizeTimer = setTimeout(() => map?.invalidateSize(), 100);
    });
    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      map?.remove();
      map = undefined;
    };
  }, [incidents, onOpen, large, filter, demo, locations]);
  return (
    <div
      ref={ref}
      className={`map ${large ? "map-large" : ""}`}
      aria-label={
        demo ? "แผนที่เหตุสาธารณภัย ข้อมูลตัวอย่าง" : "แผนที่เหตุสาธารณภัย"
      }
    />
  );
}
