import { sampleWatches } from "./sampleData";
import type { CabinetSnapshot, Watch } from "./types";
import { makeWatchImage } from "./watchImages";

const STORAGE_KEY = "watchlist-cabinet-state-v3";
const LEGACY_STORAGE_KEY = "watchlist-cabinet-state-v2";

const fallbackSnapshot: CabinetSnapshot = {
  watches: sampleWatches,
  filters: { tab: "all", category: "all", query: "" },
  budget: 6000
};

export function loadLocalSnapshot(): CabinetSnapshot {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);

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
      },
      budget: Number(saved.budget) || 6000
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
