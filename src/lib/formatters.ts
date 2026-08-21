export { formatCurrency, formatWatchCount, normalizeUrl, getDomain } from "../shared/utils";

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
