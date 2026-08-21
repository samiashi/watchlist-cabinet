import { makeWatchImage as makeWatchImageSvg, normalizeImageUrls as normalizeImageUrlSources, getStorageImagePath, normalizeImagePaths, normalizeAllImagePaths } from "../shared/utils";
import type { WatchCategory } from "./types";

export { getStorageImagePath, normalizeImagePaths, normalizeAllImagePaths };
export const makeWatchImage: (category: WatchCategory | string, seed?: string | number) => string = makeWatchImageSvg;

export function normalizeImageUrls(imageUrls: unknown, imageUrl: unknown): string[] {
  const sources: unknown[] = [];
  if (Array.isArray(imageUrls)) sources.push(imageUrls);
  if (typeof imageUrl === "string" && imageUrl.trim()) sources.push(imageUrl);
  return normalizeImageUrlSources(...sources);
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
