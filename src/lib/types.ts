export const categories = ["Chronograph", "Daily", "Diver", "Dress", "Field", "GMT", "Pilot", "Vintage"] as const;
export const movements = ["Automatic", "Manual", "Quartz"] as const;
export const maxWatchImages = 5;

export type WatchCategory = (typeof categories)[number];
export type WatchStatus = "owned" | "wishlist";
export type WatchTab = "all" | WatchStatus;
export type WatchSort = "relevance" | "price-desc" | "price-asc";
export type WatchMovement = (typeof movements)[number];

export interface Watch {
  id: string;
  brand: string;
  model: string;
  category: WatchCategory;
  status: WatchStatus;
  movement: WatchMovement;
  caseSize: number;
  price: number;
  referenceNumber: string;
  sourceUrl: string;
  imageUrl: string;
  imageUrls: string[];
  imagePaths: string[];
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
