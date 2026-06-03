import type { Watch } from "./types";
import { makeWatchImage } from "./watchImages";

const watches: Omit<Watch, "imageUrl">[] = [
  {
    id: "seed-001",
    brand: "Nomos",
    model: "Tangente 38",
    category: "Dress",
    status: "wishlist",
    price: 8950,
    sourceUrl: "https://example-watch-shop.com/nomos-tangente-38",
    createdAt: "2026-05-03T09:00:00.000Z"
  },
  {
    id: "seed-002",
    brand: "Seiko",
    model: "SPB143 Diver",
    category: "Diver",
    status: "owned",
    price: 3600,
    sourceUrl: "https://example-watch-shop.com/seiko-spb143-diver",
    createdAt: "2026-04-16T09:00:00.000Z"
  },
  {
    id: "seed-003",
    brand: "Hamilton",
    model: "Khaki Field Mechanical",
    category: "Field",
    status: "owned",
    price: 2200,
    sourceUrl: "https://example-watch-shop.com/hamilton-khaki-field-mechanical",
    createdAt: "2026-03-02T09:00:00.000Z"
  },
  {
    id: "seed-004",
    brand: "Tissot",
    model: "PRX Chronograph",
    category: "Chronograph",
    status: "wishlist",
    price: 7350,
    sourceUrl: "https://example-watch-shop.com/tissot-prx-chronograph",
    createdAt: "2026-05-22T09:00:00.000Z"
  },
  {
    id: "seed-005",
    brand: "Baltic",
    model: "Aquascaphe GMT",
    category: "GMT",
    status: "wishlist",
    price: 4400,
    sourceUrl: "https://example-watch-shop.com/baltic-aquascaphe-gmt",
    createdAt: "2026-05-24T09:00:00.000Z"
  },
  {
    id: "seed-006",
    brand: "Christopher Ward",
    model: "C63 Sealander",
    category: "Daily",
    status: "owned",
    price: 3650,
    sourceUrl: "https://example-watch-shop.com/christopher-ward-c63-sealander",
    createdAt: "2026-02-12T09:00:00.000Z"
  }
];

export const sampleWatches: Watch[] = watches.map((watch, index) => ({
  ...watch,
  imageUrl: makeWatchImage(watch.category, index)
}));
