import { maxWatchImages, type WatchCategory } from "../lib/types";

export interface WatchCategoryTheme {
  bg: string;
  case: string;
  dial: string;
  strap: string;
  detail: string;
}

export const categoryThemes: Record<WatchCategory, WatchCategoryTheme> = {
  Chronograph: { bg: "#1a191b", case: "#8d9294", dial: "#23272a", strap: "#111317", detail: "#d66b7e" },
  Daily: { bg: "#17191d", case: "#7c838a", dial: "#20252a", strap: "#26221f", detail: "#7fb4cb" },
  Diver: { bg: "#101d24", case: "#7794a1", dial: "#102a34", strap: "#121d24", detail: "#d4e8ef" },
  Dress: { bg: "#1b1714", case: "#d5b26a", dial: "#f0dfbf", strap: "#17191d", detail: "#5d4930" },
  Field: { bg: "#151d15", case: "#7c8e73", dial: "#1c261b", strap: "#202718", detail: "#dfe8d4" },
  GMT: { bg: "#131c24", case: "#7895a6", dial: "#17242b", strap: "#121c23", detail: "#d5b26a" },
  Pilot: { bg: "#161b22", case: "#8a929a", dial: "#101419", strap: "#1f252c", detail: "#d8e2ec" },
  Vintage: { bg: "#1d1914", case: "#b89462", dial: "#efe0c1", strap: "#241b16", detail: "#7f5d3b" }
};

export function hashSeed(seed: string | number): number {
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function makeWatchImage(category: WatchCategory | string, seed: string | number = 0): string {
  const theme = categoryThemes[category as WatchCategory] || categoryThemes.Daily;
  const rotation = hashSeed(seed) % 12;
  const accentX = 58 + rotation;
  const isChronograph = category === "Chronograph";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 360" role="img" aria-label="${category} watch illustration">
      <rect width="520" height="360" fill="${theme.bg}"/>
      <path d="M0 304 C105 254 174 313 277 271 C380 229 433 252 520 211 L520 360 L0 360 Z" fill="#f5f1ea" opacity="0.08"/>
      <g transform="translate(260 180)">
        <rect x="-46" y="-160" width="92" height="112" rx="22" fill="${theme.strap}"/>
        <rect x="-44" y="48" width="88" height="132" rx="22" fill="${theme.strap}"/>
        <rect x="-77" y="-76" width="154" height="154" rx="77" fill="${theme.case}"/>
        <rect x="-63" y="-62" width="126" height="126" rx="63" fill="${theme.dial}"/>
        <circle cx="0" cy="0" r="5" fill="${theme.detail}"/>
        <g stroke="${theme.detail}" stroke-width="5" stroke-linecap="round">
          <line x1="0" y1="0" x2="${accentX - 58}" y2="-42"/>
          <line x1="0" y1="0" x2="37" y2="${10 + rotation}"/>
        </g>
        <g stroke="${theme.detail}" stroke-width="3" stroke-linecap="round">
          <line x1="0" y1="-50" x2="0" y2="-42"/>
          <line x1="50" y1="0" x2="42" y2="0"/>
          <line x1="0" y1="50" x2="0" y2="42"/>
          <line x1="-50" y1="0" x2="-42" y2="0"/>
        </g>
        <circle cx="-25" cy="16" r="${isChronograph ? "13" : "0"}" fill="none" stroke="${theme.detail}" stroke-width="3"/>
        <circle cx="25" cy="16" r="${isChronograph ? "13" : "0"}" fill="none" stroke="${theme.detail}" stroke-width="3"/>
        <rect x="-14" y="-96" width="28" height="20" rx="7" fill="${theme.case}"/>
        <rect x="-14" y="76" width="28" height="20" rx="7" fill="${theme.case}"/>
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function normalizeUrl(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function getDomain(value: unknown): string {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./, "");
  } catch {
    return "source link";
  }
}

export function formatCurrency(value: unknown): string {
  const amount = new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

  return `AED ${amount}`;
}

export function formatWatchCount(value: unknown): string {
  const count = Number(value) || 0;
  return `${count} ${count === 1 ? "watch" : "watches"}`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeMarkdown(value: unknown): string {
  return String(value ?? "").replace(/[\\`*_{}[\]()#+\-.!|<>]/g, "\\$&");
}

export function getStorageImagePath(value: unknown): string {
  if (typeof value !== "string") return "";

  try {
    const url = new URL(value, "https://storage.local");
    const markers = [
      "/storage/v1/object/public/watch-images/",
      "/storage/v1/object/sign/watch-images/",
      "/object/public/watch-images/",
      "/object/sign/watch-images/"
    ];
    const marker = markers.find((item) => url.pathname.includes(item)) || "";
    if (!marker) return "";

    return decodeURIComponent(url.pathname.split(marker)[1] || "").replace(/^\/+/, "");
  } catch {
    return "";
  }
}

export function normalizeImageUrls(...sources: unknown[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  sources.forEach((source) => {
    const values = Array.isArray(source) ? source : [source];
    values.forEach((value) => {
      if (typeof value !== "string") return;
      const url = value.trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      urls.push(url);
    });
  });

  return urls.slice(0, maxWatchImages);
}

export function normalizeImagePaths(...sources: unknown[]): string[] {
  return collectImagePaths(maxWatchImages, ...sources);
}

export function normalizeAllImagePaths(...sources: unknown[]): string[] {
  return collectImagePaths(Number.POSITIVE_INFINITY, ...sources);
}

function collectImagePaths(limit: number, ...sources: unknown[]): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  sources.forEach((source) => {
    const values = Array.isArray(source) ? source : [source];
    values.forEach((value) => {
      if (typeof value !== "string") return;
      const path = value.trim().replace(/^\/+/, "");
      if (!path || seen.has(path)) return;
      seen.add(path);
      paths.push(path);
    });
  });

  return paths.slice(0, limit);
}
