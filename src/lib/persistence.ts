import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Store } from "./model";
import { defaultConnection } from "./supabase-config";
export const STORE_KEY = "drc-demo-v1";
export function saveStore(s: Store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}
let cached: SupabaseClient<any> | null = null;
let cachedConfig = "";
export function client() {
  const raw = localStorage.getItem("drc-connection") || JSON.stringify(defaultConnection);
  if (cachedConfig === raw) return cached;
  const config = JSON.parse(raw);
  cachedConfig = raw;
  cached =
    config?.url && config?.key ? createClient(config.url, config.key) : null;
  return cached;
}
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("drc-media", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function putPhoto(id: string, file: Blob) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction("photos", "readwrite");
    t.objectStore("photos").put(file, id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  d.close();
}
export async function getPhoto(id: string) {
  const d = await db();
  return new Promise<Blob | undefined>((resolve, reject) => {
    const r = d.transaction("photos").objectStore("photos").get(id);
    r.onsuccess = () => {
      d.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
  });
}
