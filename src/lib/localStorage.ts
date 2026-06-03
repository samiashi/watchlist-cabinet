import { sampleWatches } from "./sampleData";
import type { CabinetSnapshot, Watch, WatchMovement } from "./types";
import { makeWatchImage } from "./watchImages";

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
        tab: saved.filters?.tab || "all",
        query: saved.filters?.query || "",
        sort: saved.filters?.sort || "relevance"
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

function normalizeStoredWatch(watch: Watch, index: number): Watch {
  return {
    id: watch.id,
    brand: watch.brand,
    model: watch.model,
    category: watch.category,
    status: watch.status,
    movement: normalizeMovement(watch.movement),
    caseSize: Number(watch.caseSize) || 0,
    price: Number(watch.price) || 0,
    sourceUrl: watch.sourceUrl,
    imageUrl: watch.imageUrl || makeWatchImage(watch.category, index),
    createdAt: watch.createdAt,
    updatedAt: watch.updatedAt
  };
}

function normalizeMovement(value: unknown): WatchMovement {
  return value === "Quartz" ? "Quartz" : "Automatic";
}
