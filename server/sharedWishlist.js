import { createClient } from "@supabase/supabase-js";

const watchImageBucket = "watch-images";
const signedImageExpiresIn = 60 * 60;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SharedWishlistError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "SharedWishlistError";
    this.statusCode = statusCode;
  }
}

export async function loadSharedWishlist(token) {
  const shareToken = validateShareToken(token);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new SharedWishlistError(500, "Shared wishlist signing is not configured.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const shareResult = await supabase
    .from("watch_share_links")
    .select("user_id")
    .eq("token", shareToken)
    .maybeSingle();

  if (shareResult.error) {
    throw new SharedWishlistError(500, "Shared wishlist could not be loaded.");
  }

  if (!shareResult.data?.user_id) {
    throw new SharedWishlistError(404, "This wishlist link is not available.");
  }

  const watchesResult = await supabase
    .from("watches")
    .select("id,brand,model,category,status,movement,case_size_mm,price,reference_number,source_url,image_url,image_urls,image_paths,created_at,updated_at")
    .eq("user_id", shareResult.data.user_id)
    .eq("status", "wishlist")
    .order("created_at", { ascending: false });

  if (watchesResult.error) {
    throw new SharedWishlistError(500, "Shared wishlist could not be loaded.");
  }

  const rows = watchesResult.data || [];
  const signedUrlMap = await getSignedImageUrlMap(supabase, supabaseUrl, rows);
  const watches = rows.map((row) => toSharedWatch(row, signedUrlMap));
  const wishlistTotal = watches.reduce((total, watch) => total + watch.price, 0);

  return {
    token: shareToken,
    generated_at: new Date().toISOString(),
    summary: {
      count: watches.length,
      currency: "AED",
      wishlist_total: wishlistTotal
    },
    watches
  };
}

export function validateShareToken(token) {
  const shareToken = String(token || "").trim();
  if (!uuidPattern.test(shareToken)) {
    throw new SharedWishlistError(400, "Invalid share token.");
  }

  return shareToken;
}

export function sendSharedWishlistError(response, error, contentType = "json") {
  const statusCode = error instanceof SharedWishlistError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : "Shared wishlist could not be loaded.";

  if (contentType === "html") {
    response.status(statusCode).send(renderErrorHtml(statusCode, message));
    return;
  }

  if (contentType === "markdown") {
    response.status(statusCode).send(`# Shared wishlist unavailable\n\n${message}\n`);
    return;
  }

  response.status(statusCode).json({ error: message });
}

export function formatCurrency(value) {
  const amount = new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

  return `AED ${amount}`;
}

export function formatWatchCount(value) {
  const count = Number(value) || 0;
  return `${count} ${count === 1 ? "watch" : "watches"}`;
}

export function getDomain(value) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./, "");
  } catch {
    return "source link";
  }
}

export function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function getRequestBaseUrl(request) {
  const host = String(request.headers.host || "watchlist-cabinet.vercel.app").split(",")[0].trim();
  const forwardedProtocol = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProtocol || (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host) ? "http" : "https");
  return `${protocol}://${host}`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeMarkdown(value) {
  return String(value ?? "").replace(/[\\`*_{}[\]()#+\-.!|]/g, "\\$&");
}

export function renderSharedWishlistMarkdown(data, baseUrl, options = {}) {
  const shareUrl = `${baseUrl}/share/${encodeURIComponent(data.token)}`;
  const textUrl = `${shareUrl}.txt`;
  const jsonUrl = `${shareUrl}.json`;
  const lines = [
    "# Watch Wishlist",
    "",
    "Shared from Cabinet.",
    "",
    `- Wishlist total: ${escapeMarkdown(formatCurrency(data.summary.wishlist_total))}`,
    `- Saved watches: ${escapeMarkdown(formatWatchCount(data.summary.count))}`,
    `- Text: <${textUrl}>`,
    `- JSON: <${jsonUrl}>`,
    ""
  ];

  if (!data.watches.length) {
    lines.push("No wishlist watches yet.", "");
    return lines.join("\n");
  }

  data.watches.forEach((watch, index) => {
    lines.push(`## ${index + 1}. ${escapeMarkdown(`${watch.brand} ${watch.model}`.trim() || "Untitled watch")}`);
    lines.push("");
    lines.push(`- Brand: ${escapeMarkdown(watch.brand || "Not listed")}`);
    lines.push(`- Model: ${escapeMarkdown(watch.model || "Not listed")}`);
    lines.push(`- Price: ${escapeMarkdown(formatCurrency(watch.price))}`);
    lines.push(`- Category: ${escapeMarkdown(watch.category || "Not listed")}`);
    lines.push(`- Movement: ${escapeMarkdown(watch.movement || "Not listed")}`);
    lines.push(`- Case size: ${watch.case_size_mm ? `${escapeMarkdown(watch.case_size_mm)} mm` : "Not listed"}`);
    if (watch.reference_number) lines.push(`- Reference: ${escapeMarkdown(watch.reference_number)}`);
    if (watch.source_url) lines.push(`- Source: <${watch.source_url}>`);
    if (options.includeImages !== false && watch.image_urls.length) {
      lines.push("- Images:");
      watch.image_urls.forEach((url) => lines.push(`  - <${url}>`));
    }
    lines.push("");
  });

  return lines.join("\n");
}

export function renderCompactWishlistText(data) {
  const lines = [
    "Watch Wishlist",
    `Wishlist total: ${formatCurrency(data.summary.wishlist_total)}`,
    `Saved watches: ${formatWatchCount(data.summary.count)}`,
    ""
  ];

  if (!data.watches.length) {
    lines.push("No wishlist watches yet.");
    return lines.join("\n");
  }

  data.watches.forEach((watch, index) => {
    const title = `${watch.brand} ${watch.model}`.trim() || "Untitled watch";
    const caseSize = watch.case_size_mm ? `${watch.case_size_mm} mm` : "case size not listed";
    const reference = watch.reference_number ? `, ref ${watch.reference_number}` : "";
    const source = watch.source_url ? `, source ${getDomain(watch.source_url)}` : "";
    lines.push(
      `${index + 1}. ${title} - ${formatCurrency(watch.price)} - ${watch.category || "category not listed"} - ${watch.movement || "movement not listed"} - ${caseSize}${reference}${source}`
    );
  });

  return lines.join("\n");
}

export function renderSharedWishlistText(data, baseUrl) {
  const shareUrl = `${baseUrl}/share/${encodeURIComponent(data.token)}`;
  return [
    renderCompactWishlistText(data),
    "",
    `HTML: ${shareUrl}`,
    `Text: ${shareUrl}.txt`,
    `Markdown: ${shareUrl}.md`,
    `JSON: ${shareUrl}.json`
  ].join("\n");
}

export function renderMetaWishlistSummary(data) {
  const watchTitles = data.watches.map((watch, index) => {
    const title = `${watch.brand} ${watch.model}`.trim() || "Untitled watch";
    return `${index + 1}. ${title} (${formatCurrency(watch.price)}, ${watch.category || "uncategorized"}, ${watch.movement || "movement not listed"})`;
  });

  return `${formatWatchCount(data.summary.count)} totaling ${formatCurrency(data.summary.wishlist_total)}: ${watchTitles.join("; ")}`;
}

function toSharedWatch(row, signedUrlMap) {
  const externalUrls = getExternalImageUrls(row);
  const signedUrls = getStoragePaths(row).map((path) => signedUrlMap.get(path)).filter(Boolean);
  const imageUrls = normalizeImageUrls([...externalUrls, ...signedUrls]);

  return {
    id: row.id,
    brand: normalizeText(row.brand),
    model: normalizeText(row.model),
    category: normalizeText(row.category),
    status: "wishlist",
    movement: normalizeMovement(row.movement),
    case_size_mm: Number(row.case_size_mm) || 0,
    price: Number(row.price) || 0,
    reference_number: normalizeText(row.reference_number),
    source_url: normalizeUrl(row.source_url),
    image_url: imageUrls[0] || null,
    image_urls: imageUrls,
    image_paths: [],
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function getSignedImageUrlMap(supabase, supabaseUrl, rows) {
  const allPaths = normalizeAllImagePaths(rows.flatMap((row) => getStoragePaths(row)));
  const signedUrlMap = new Map();

  if (!allPaths.length) return signedUrlMap;

  const signedResult = await supabase.storage.from(watchImageBucket).createSignedUrls(allPaths, signedImageExpiresIn);
  if (signedResult.error) {
    throw new SharedWishlistError(500, "Shared wishlist images could not be signed.");
  }

  allPaths.forEach((path, index) => {
    const indexedUrl = getSignedUrl(signedResult.data?.[index]);
    const matchingUrl = indexedUrl || getSignedUrl(signedResult.data?.find((item) => item.path === path));
    const signedUrl = toAbsoluteStorageUrl(matchingUrl, supabaseUrl);
    if (signedUrl) signedUrlMap.set(path, signedUrl);
  });

  return signedUrlMap;
}

function getExternalImageUrls(row) {
  return normalizeImageUrls(row.image_urls, row.image_url).filter((url) => !getStorageImagePath(url));
}

function getStoragePaths(row) {
  const legacyPaths = normalizeImageUrls(row.image_urls, row.image_url).map(getStorageImagePath).filter(Boolean);
  return normalizeImagePaths(row.image_paths, legacyPaths);
}

function normalizeImageUrls(...sources) {
  const urls = [];
  const seen = new Set();

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

  return urls.slice(0, 5);
}

function normalizeImagePaths(...sources) {
  return collectImagePaths(5, ...sources);
}

function normalizeAllImagePaths(...sources) {
  return collectImagePaths(Number.POSITIVE_INFINITY, ...sources);
}

function collectImagePaths(limit, ...sources) {
  const paths = [];
  const seen = new Set();

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

function getStorageImagePath(value) {
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

function getSignedUrl(value) {
  if (!value || typeof value !== "object") return "";
  if (typeof value.signedUrl === "string") return value.signedUrl;
  if (typeof value.signedURL === "string") return value.signedURL;
  return "";
}

function toAbsoluteStorageUrl(value, baseUrl) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (!baseUrl) return url;

  const base = baseUrl.replace(/\/+$/, "");
  const path = url.replace(/^\/+/, "");
  return `${base}/${path.startsWith("storage/v1/") ? path : `storage/v1/${path}`}`;
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeMovement(value) {
  const movement = normalizeText(value);
  return movement === "Manual" || movement === "Quartz" ? movement : "Automatic";
}

function renderErrorHtml(statusCode, message) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Shared wishlist unavailable</title>
    <style>
      :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif; background: #050506; color: #f5f5f7; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; }
      main { max-width: 560px; border: 1px solid rgba(255,255,255,.14); border-radius: 24px; padding: 28px; background: #1c1c1e; }
      p { color: #a1a1aa; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <p>Error ${statusCode}</p>
      <h1>Shared wishlist unavailable</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`;
}
