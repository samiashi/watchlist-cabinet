export const watchImageBucket = "watch-images";
export const signedImageExpiresIn = 60 * 60;

export function getSignedUrl(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const item = value as { signedUrl?: unknown; signedURL?: unknown };
  return typeof item.signedUrl === "string" ? item.signedUrl : typeof item.signedURL === "string" ? item.signedURL : "";
}

export function toAbsoluteStorageUrl(value: unknown, baseUrl: string | undefined): string {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (!baseUrl) return url;

  const base = baseUrl.replace(/\/+$/, "");
  const path = url.replace(/^\/+/, "");
  return `${base}/${path.startsWith("storage/v1/") ? path : `storage/v1/${path}`}`;
}

export function isUserImagePath(path: string, ownerId: string): boolean {
  return typeof ownerId === "string" && path.startsWith(`${ownerId}/`);
}

export function isMissingDisplayOrderError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const item = error as { code?: unknown; message?: unknown };
  return item.code === "42703" || String(item.message || "").toLowerCase().includes("display_order");
}

export function isMissingRpcError(error: unknown, functionName: string): boolean {
  if (!error || typeof error !== "object") return false;
  const item = error as { code?: unknown; message?: unknown };
  const message = String(item.message || "");
  return item.code === "PGRST202" || item.code === "404" || message.includes(functionName);
}
