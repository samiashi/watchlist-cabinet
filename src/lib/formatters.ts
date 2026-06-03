export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function formatCurrency(value: number) {
  const amount = new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

  return `AED ${amount}`;
}

export function formatWatchCount(value: number) {
  const count = Number(value) || 0;
  return `${count} ${count === 1 ? "watch" : "watches"}`;
}

export function normalizeUrl(value: FormDataEntryValue | string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function getDomain(value: string) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./, "");
  } catch {
    return "source link";
  }
}

export function cleanText(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `watch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
