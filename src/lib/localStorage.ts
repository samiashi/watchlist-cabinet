import { sampleWatches } from "./sampleData";
import type { CabinetSnapshot, Watch } from "./types";
import { makeWatchImage } from "./watchImages";

const STORAGE_KEY = "watchlist-cabinet-state-v4";
const LEGACY_STORAGE_KEYS = ["watchlist-cabinet-state-v3", "watchlist-cabinet-state-v2"];

const fallbackSnapshot: CabinetSnapshot = {
  watches: sampleWatches,
  filters: { tab: "all", category: "all", query: "" }
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
        category: saved.filters?.category || "all",
        query: saved.filters?.query || ""
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
    ...watch,
    price: Number(watch.price) || 0,
    imageUrl: watch.imageUrl || makeWatchImage(watch.category, index)
  };
}
