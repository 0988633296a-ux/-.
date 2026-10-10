import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ปภ. ตำบลลำห้วยหลัว | ระบบบริหารจัดการเหตุสาธารณภัย",
  description: "ระบบรับแจ้ง จัดกำลัง และติดตามเหตุสาธารณภัย",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ศูนย์ ปภ.", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#172b4d",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="icon" href="/icon.svg" />
        <link
          rel="preload"
          href="/fonts/noto-thai-400.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
