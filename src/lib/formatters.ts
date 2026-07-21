import {
  formatCurrency as _formatCurrency,
  formatWatchCount as _formatWatchCount,
  normalizeUrl as _normalizeUrl,
  getDomain as _getDomain
} from "../shared/utils.js";

export const formatCurrency: (value: unknown) => string = _formatCurrency;
export const formatWatchCount: (value: unknown) => string = _formatWatchCount;
export const normalizeUrl: (value: unknown) => string = _normalizeUrl;
export const getDomain: (value: unknown) => string = _getDomain;

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function cleanText(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `watch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
