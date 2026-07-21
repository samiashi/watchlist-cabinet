import { getStorageImagePath, getWatchImages, makeWatchImage, normalizeImagePaths } from "../lib/watchImages";
import { maxWatchImages, type Watch, type WatchMovement } from "../lib/types";

export const pendingImageFiles = new Map<string, File>();

export function clearPendingImageFiles() {
  pendingImageFiles.forEach((_file, id) => {
    pendingImageFiles.delete(id);
  });
}

export type ManagedImage =
  | { id: string; kind: "stored"; path: string; url: string }
  | { id: string; kind: "upload"; file: File; url: string };

export function getStoredImageItems(watch: Watch): Extract<ManagedImage, { kind: "stored" }>[] {
  const imageUrlByPath = new Map<string, string>();
  getWatchImages(watch).forEach((url) => {
    const path = getStorageImagePath(url);
    if (path) imageUrlByPath.set(path, url);
  });

  return normalizeImagePaths(watch.imagePaths, [...imageUrlByPath.keys()]).map((path) => ({
    id: `stored-${path}`,
    kind: "stored" as const,
    path,
    url: imageUrlByPath.get(path) || makeWatchImage(watch.category, watch.id)
  }));
}

export function getFormImageOrder(form: FormData) {
  return form
    .getAll("imageOrder")
    .filter((value): value is string => typeof value === "string")
    .filter((value) => value.startsWith("path:") || value.startsWith("upload:"))
    .slice(0, maxWatchImages);
}

export function getFormImageUploadIds(form: FormData) {
  return form
    .getAll("imageUploadIds")
    .filter((value): value is string => typeof value === "string" && value.startsWith("upload-"))
    .slice(0, maxWatchImages);
}

export function getFormImageFiles(form: FormData) {
  return getFormImageUploadIds(form)
    .map((uploadId) => pendingImageFiles.get(uploadId))
    .filter((file): file is File => Boolean(file && file.size > 0))
    .slice(0, maxWatchImages);
}

export function normalizeMovement(value: FormDataEntryValue | string | null | undefined) {
  const movement = String(value || "").trim();
  const movements = ["Automatic", "Manual", "Quartz"];
  return movements.includes(movement as WatchMovement) ? (movement as WatchMovement) : "Automatic";
}

export function sortWatchesByCustomOrder(watches: Watch[]) {
  return [...watches].sort(compareByCustomOrder);
}

function compareByCustomOrder(a: Watch, b: Watch) {
  const orderDifference = normalizeWatchDisplayOrder(a) - normalizeWatchDisplayOrder(b);
  return orderDifference || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

function normalizeWatchDisplayOrder(watch: Watch) {
  const order = Number(watch.displayOrder);
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

export function formatCaseSize(value: number) {
  const size = Number(value) || 0;
  if (!size) return "";
  return `${Number.isInteger(size) ? size : size.toFixed(1)} mm`;
}
