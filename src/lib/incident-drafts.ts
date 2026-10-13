export type DraftPhoto = { id: string; name: string; at: string };
export type IncidentDraft<T> = {
  draft: T;
  photos: DraftPhoto[];
  savedAt: string;
};
type DraftStorage = Pick<Storage, "getItem" | "setItem">;

export const INCIDENT_PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic";
export function validateIncidentPhoto(
  file: Pick<Blob, "type" | "size">,
): string | null {
  if (!INCIDENT_PHOTO_ACCEPT.split(",").includes(file.type.toLowerCase()))
    return "รองรับภาพ JPEG, PNG, WebP และ HEIC เท่านั้น";
  if (file.size > 15 * 1024 * 1024) return "ภาพต้องมีขนาดไม่เกิน 15 MB";
  return null;
}
export function incidentDraftKey(
  scope: string | undefined,
  live = false,
): string | null {
  if (live && !scope) return null;
  return `drc-incident-draft-v2:${live ? "live" : "demo"}:${encodeURIComponent(scope || "local")}`;
}
export function readIncidentDraft<T>(
  storage: DraftStorage,
  key: string | null,
): IncidentDraft<T> | null {
  if (!key) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (
    !value ||
    typeof value.draft !== "object" ||
    !value.draft ||
    !Array.isArray(value.photos) ||
    typeof value.savedAt !== "string"
  )
    throw Error("อ่านร่างที่บันทึกไว้ไม่สำเร็จ");
  if (
    value.photos.some(
      (p: DraftPhoto) =>
        !p ||
        typeof p.id !== "string" ||
        typeof p.name !== "string" ||
        typeof p.at !== "string",
    )
  )
    throw Error("อ่านภาพในร่างไม่สำเร็จ");
  return value;
}
export function writeIncidentDraft<T>(
  storage: DraftStorage,
  key: string | null,
  draft: T,
  photos: DraftPhoto[],
  savedAt = new Date().toISOString(),
) {
  if (!key) throw Error("ไม่สามารถระบุบัญชีสำหรับเก็บร่างได้");
  storage.setItem(key, JSON.stringify({ draft, photos, savedAt }));
}
export async function persistDraftPhotos(
  files: Array<Blob & { name: string }>,
  put: (id: string, file: Blob) => Promise<void>,
  makeId: () => string,
): Promise<DraftPhoto[]> {
  for (const file of files) {
    const error = validateIncidentPhoto(file);
    if (error) throw Error(error);
  }
  const photos: DraftPhoto[] = [];
  for (const file of files) {
    const id = makeId();
    await put(id, file);
    photos.push({ id, name: file.name, at: new Date().toISOString() });
  }
  return photos;
}
