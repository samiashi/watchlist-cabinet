import { sampleWatches } from "./sampleData";
import { categories, movements, type CabinetSnapshot, type Watch, type WatchCategory, type WatchMovement, type WatchStatus, type WatchTab, type WatchSort } from "./types";
import { getStorageImagePath, isStorageImageUrl, makeWatchImage, normalizeImagePaths, normalizeImageUrls } from "./watchImages";

const STORAGE_KEY = "watchlist-cabinet-state-v4";
const LEGACY_STORAGE_KEYS = ["watchlist-cabinet-state-v3", "watchlist-cabinet-state-v2"];

const fallbackSnapshot: CabinetSnapshot = {
  watches: sampleWatches,
  filters: { tab: "all", query: "", sort: "relevance" }
};

export function loadLocalSnapshot(): CabinetSnapshot {
  const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);

  if (!raw) return fallbackSnapshot;

  try {
    const saved = JSON.parse(raw) as Partial<CabinetSnapshot>;
    if (!Array.isArray(saved.watches)) return fallbackSnapshot;

    return {
      watches: saved.watches.map(normalizeStoredWatch),
      filters: {
        tab: normalizeTab(saved.filters?.tab),
        query: saved.filters?.query || "",
        sort: normalizeSort(saved.filters?.sort)
      }
    };
  } catch (error) {
    console.warn("Could not load Watchlist Cabinet state", error);
    return fallbackSnapshot;
  }
}

export function saveLocalSnapshot(snapshot: CabinetSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function normalizeStoredWatch(watch: Partial<Watch>, index: number): Watch {
  const category = normalizeCategory(watch.category);
  const rawImageUrls = normalizeImageUrls(watch.imageUrls, watch.imageUrl);
  const externalImageUrls = rawImageUrls.filter((url) => !isStorageImageUrl(url));
  const storagePaths = rawImageUrls.map(getStorageImagePath).filter(Boolean);
  const imagePaths = normalizeImagePaths(watch.imagePaths, storagePaths);
  const imageUrls = normalizeImageUrls(externalImageUrls, null, makeWatchImage(category, index));

  return {
    id: watch.id || `local-${index}`,
    brand: watch.brand || "",
    model: watch.model || "",
    category,
    status: normalizeStatus(watch.status),
    movement: normalizeMovement(watch.movement),
    caseSize: Number(watch.caseSize) || 0,
    price: Number(watch.price) || 0,
    referenceNumber: watch.referenceNumber || "",
    sourceUrl: watch.sourceUrl || "",
    imageUrl: imageUrls[0],
    imageUrls,
    imagePaths,
    displayOrder: normalizeDisplayOrder(watch.displayOrder, index),
    createdAt: watch.createdAt || new Date().toISOString(),
    updatedAt: watch.updatedAt
  };
}

function normalizeCategory(value: unknown): WatchCategory {
  return categories.includes(value as WatchCategory) ? (value as WatchCategory) : "Daily";
}

function normalizeStatus(value: unknown): WatchStatus {
  return value === "owned" ? "owned" : "wishlist";
}

function normalizeMovement(value: unknown): WatchMovement {
  return movements.includes(value as WatchMovement) ? (value as WatchMovement) : "Automatic";
}

function normalizeTab(value: unknown): WatchTab {
  return value === "owned" || value === "wishlist" || value === "all" ? value : "all";
}

function normalizeSort(value: unknown): WatchSort {
  return value === "price-desc" || value === "price-asc" || value === "relevance" ? value : "relevance";
}

function normalizeDisplayOrder(value: unknown, index: number) {
  const order = Number(value);
  return Number.isFinite(order) ? order : (index + 1) * 1000;
}
