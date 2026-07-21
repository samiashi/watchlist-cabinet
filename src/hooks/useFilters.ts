import { useMemo, useState } from "react";
import { getDomain } from "../lib/formatters";
import type { CabinetFilters, CabinetSummary, Watch } from "../lib/types";

const emptyFilters: CabinetFilters = { tab: "all", query: "", sort: "relevance" };

export function useFilters(watches: Watch[]) {
  const [filters, setFilters] = useState<CabinetFilters>(emptyFilters);

  const summary = useMemo(() => getSummary(watches), [watches]);
  const filteredWatches = useMemo(() => getFilteredWatches(watches, filters), [filters, watches]);

  function updateFilters(nextFilters: Partial<CabinetFilters>) {
    setFilters((current) => ({ ...current, ...nextFilters }));
  }

  return { filters, setFilters, updateFilters, summary, filteredWatches };
}

function getSummary(watches: Watch[]): CabinetSummary {
  const owned = watches.filter((watch) => watch.status === "owned");
  const wishlist = watches.filter((watch) => watch.status === "wishlist");
  const wishlistTotal = wishlist.reduce((total, w) => total + (Number(w.price) || 0), 0);
  const ownedValue = owned.reduce((total, w) => total + (Number(w.price) || 0), 0);

  return {
    ownedCount: owned.length,
    wishlistCount: wishlist.length,
    wishlistTotal,
    ownedValue
  };
}

function getFilteredWatches(watches: Watch[], filters: CabinetFilters) {
  const query = filters.query.trim().toLowerCase();

  return [...watches]
    .filter((watch) => filters.tab === "all" || watch.status === filters.tab)
    .filter((watch) => {
      if (!query) return true;

      const haystack = [watch.brand, watch.model, watch.referenceNumber, watch.category, watch.status, watch.movement, formatCaseSize(watch.caseSize), getDomain(watch.sourceUrl)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => compareWatches(a, b, filters.sort, query));
}

function compareWatches(a: Watch, b: Watch, sort: CabinetFilters["sort"], query: string) {
  if (sort === "price-desc") {
    return (Number(b.price) || 0) - (Number(a.price) || 0) || compareByCustomOrder(a, b);
  }

  if (sort === "price-asc") {
    return (Number(a.price) || 0) - (Number(b.price) || 0) || compareByCustomOrder(a, b);
  }

  if (sort === "newest") {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime() || compareByCustomOrder(a, b);
  }

  return getWatchRelevance(b, query) - getWatchRelevance(a, query) || compareByCustomOrder(a, b);
}

function compareByCustomOrder(a: Watch, b: Watch) {
  const orderDifference = normalizeWatchDisplayOrder(a) - normalizeWatchDisplayOrder(b);
  return orderDifference || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

function normalizeWatchDisplayOrder(watch: Watch) {
  const order = Number(watch.displayOrder);
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function formatCaseSize(value: number) {
  const size = Number(value) || 0;
  if (!size) return "";
  return `${Number.isInteger(size) ? size : size.toFixed(1)} mm`;
}

function getWatchRelevance(watch: Watch, query: string) {
  if (!query) return 0;

  const fields = [watch.brand, watch.model, watch.referenceNumber, watch.category, watch.status, watch.movement, formatCaseSize(watch.caseSize), getDomain(watch.sourceUrl)].map((value) =>
    value.toLowerCase()
  );
  return fields.reduce((score, value) => {
    if (value === query) return score + 8;
    if (value.startsWith(query)) return score + 4;
    if (value.includes(query)) return score + 1;
    return score;
  }, 0);
}
