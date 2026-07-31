import {
  makeWatchImage as _makeWatchImage,
  normalizeImageUrls as _normalizeImageUrls,
  getStorageImagePath as _getStorageImagePath,
  normalizeImagePaths as _normalizeImagePaths,
  normalizeAllImagePaths as _normalizeAllImagePaths
} from "../shared/utils.js";
import type { WatchCategory } from "./types";

export const makeWatchImage: (category: WatchCategory, seed?: string | number) => string = _makeWatchImage as (category: WatchCategory, seed?: string | number) => string;
export const getStorageImagePath: (value: unknown) => string = _getStorageImagePath;
export const normalizeImagePaths: (...sources: unknown[]) => string[] = _normalizeImagePaths;
export const normalizeAllImagePaths: (...sources: unknown[]) => string[] = _normalizeAllImagePaths;

export function normalizeImageUrls(imageUrls: unknown, imageUrl: unknown) {
  const args: unknown[] = [];
  if (Array.isArray(imageUrls)) args.push(imageUrls);
  if (typeof imageUrl === "string" && imageUrl.trim()) args.push(imageUrl);
  return _normalizeImageUrls(...args);
}

export function getWatchImages(watch: {
  id: string;
  category: WatchCategory;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
}) {
  return normalizeImageUrls(watch.imageUrls, watch.imageUrl);
}

export function isStorageImageUrl(value: unknown) {
  return Boolean(getStorageImagePath(value));
}

export function isGeneratedWatchImage(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("data:image/svg+xml")) return false;

  try {
    const encodedSvg = value.slice(value.indexOf(",") + 1);
    const svg = decodeURIComponent(encodedSvg);
    return svg.includes('role="img"') && svg.includes(" watch illustration");
  } catch {
    return false;
  }
}
