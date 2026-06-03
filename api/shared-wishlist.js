import { createClient } from "@supabase/supabase-js";

const watchImageBucket = "watch-images";
const signedImageExpiresIn = 60 * 60;

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const token = String(request.query?.token || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    response.status(400).json({ error: "Invalid share token." });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ error: "Shared wishlist signing is not configured." });
    return;
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
    .eq("token", token)
    .maybeSingle();

  if (shareResult.error) {
    response.status(500).json({ error: "Shared wishlist could not be loaded." });
    return;
  }

  if (!shareResult.data?.user_id) {
    response.status(404).json({ error: "This wishlist link is not available." });
    return;
  }

  const watchesResult = await supabase
    .from("watches")
    .select("id,brand,model,category,status,movement,case_size_mm,price,reference_number,source_url,image_url,image_urls,image_paths,created_at,updated_at")
    .eq("user_id", shareResult.data.user_id)
    .eq("status", "wishlist")
    .order("created_at", { ascending: false });

  if (watchesResult.error) {
    response.status(500).json({ error: "Shared wishlist could not be loaded." });
    return;
  }

  const rows = watchesResult.data || [];
  const allPaths = normalizeAllImagePaths(rows.flatMap((row) => getStoragePaths(row)));
  const signedUrlMap = new Map();

  if (allPaths.length) {
    const signedResult = await supabase.storage.from(watchImageBucket).createSignedUrls(allPaths, signedImageExpiresIn);
    if (signedResult.error) {
      response.status(500).json({ error: "Shared wishlist images could not be signed." });
      return;
    }

    allPaths.forEach((path, index) => {
      const indexedUrl = getSignedUrl(signedResult.data?.[index]);
      const matchingUrl = indexedUrl || getSignedUrl(signedResult.data?.find((item) => item.path === path));
      const signedUrl = toAbsoluteStorageUrl(matchingUrl, supabaseUrl);
      if (signedUrl) signedUrlMap.set(path, signedUrl);
    });
  }

  response.status(200).json({
    watches: rows.map((row) => {
      const externalUrls = getExternalImageUrls(row);
      const signedUrls = getStoragePaths(row).map((path) => signedUrlMap.get(path)).filter(Boolean);
      const imageUrls = normalizeImageUrls([...externalUrls, ...signedUrls]);

      return {
        ...row,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls,
        image_paths: []
      };
    })
  });
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
