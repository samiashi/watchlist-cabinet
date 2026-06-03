export const categories = ["Dress", "Diver", "Field", "Chronograph", "GMT", "Daily"] as const;

export type WatchCategory = (typeof categories)[number];
export type WatchStatus = "owned" | "wishlist";
export type WatchTab = "all" | WatchStatus;
export type WatchSort = "relevance" | "price-desc" | "price-asc";

export interface Watch {
  id: string;
  brand: string;
  model: string;
  category: WatchCategory;
  status: WatchStatus;
  price: number;
  sourceUrl: string;
  imageUrl: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CabinetFilters {
  tab: WatchTab;
  query: string;
  sort: WatchSort;
}

export interface CabinetSnapshot {
  watches: Watch[];
  filters: CabinetFilters;
}

export interface CabinetSummary {
  ownedCount: number;
  wishlistCount: number;
  wishlistTotal: number;
  ownedValue: number;
}
