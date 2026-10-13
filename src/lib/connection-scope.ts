import { defaultConnection } from "./supabase-config";
export function connectionScope(): string {
  const config = JSON.parse(localStorage.getItem("drc-connection") || JSON.stringify(defaultConnection));
  return new URL(config.url).origin;
}
export const liveCacheKey = (user: string) => `drc-live-v2:${encodeURIComponent(connectionScope())}:${user}`;
export const liveProfileKey = (user: string) => `drc-profile-v2:${encodeURIComponent(connectionScope())}:${user}`;
export const scopedQueueKey = (user: string) => `drc-outbox-v2:${encodeURIComponent(connectionScope())}:${user}`;
// Never replay unknown-scope legacy commands automatically. Keep them available for backup.
export function legacyQueueCount(user: string): number {
  try { const rows = JSON.parse(localStorage.getItem("drc-outbox-" + user) || "[]"); return Array.isArray(rows) ? rows.length : 0; }
  catch { return 1; }
}
