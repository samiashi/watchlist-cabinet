export const categories = [
  { name: "Dress", target: 1 },
  { name: "Diver", target: 1 },
  { name: "Field", target: 1 },
  { name: "Chronograph", target: 1 },
  { name: "GMT", target: 1 },
  { name: "Daily", target: 2 }
] as const;

export type WatchCategory = (typeof categories)[number]["name"];
export type WatchStatus = "owned" | "wishlist";
export type WatchTab = "all" | WatchStatus;
export type CategoryFilter = "all" | WatchCategory;

export interface Watch {
  id: string;
  brand: string;
  model: string;
  category: WatchCategory;
  status: WatchStatus;
  price: number;
  sourceUrl: string;
  imageUrl: string;
  notes: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CabinetFilters {
  tab: WatchTab;
  category: CategoryFilter;
  query: string;
}

export interface CabinetSnapshot {
  watches: Watch[];
  filters: CabinetFilters;
  budget: number;
}

export interface CabinetSummary {
  ownedCount: number;
  wishlistCount: number;
  wishlistTotal: number;
  ownedValue: number;
  budgetDelta: number;
}
