import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { maxWatchImages, type CabinetSnapshot, type Watch, type WatchCategory, type WatchMovement, type WatchStatus } from "./types";
import { getStorageImagePath, isStorageImageUrl, makeWatchImage, normalizeImagePaths, normalizeImageUrls } from "./watchImages";

const watchImageBucket = "watch-images";
const signedImageExpiresIn = 60 * 60;

interface WatchRow {
  id: string;
  user_id?: string;
  brand: string;
  model: string;
  category: WatchCategory;
  status: WatchStatus;
  movement: WatchMovement | null;
  case_size_mm: number | string | null;
  price: number | string;
  reference_number?: string | null;
  source_url: string;
  image_url: string | null;
  image_urls?: string[] | null;
  image_paths?: string[] | null;
  created_at: string;
  updated_at: string;
}

interface ShareLinkRow {
  token: string;
}

export async function loadCloudSnapshot(user: User): Promise<CabinetSnapshot> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const watchesResult = await supabase
    .from("watches")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (watchesResult.error) throw watchesResult.error;
  const watches = ((watchesResult.data || []) as WatchRow[]).map(fromWatchRow);

  return {
    watches: await withSignedStorageImages(watches),
    filters: { tab: "all", query: "", sort: "relevance" }
  };
}

export async function upsertCloudWatch(user: User, watch: Watch) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("watches").upsert(toWatchRow(user, watch), {
    onConflict: "id"
  });

  if (error) throw error;
}

export async function deleteCloudWatch(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("watches").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadWatchImages(user: User, watchId: string, files: File[]) {
  const client = supabase;
  if (!client) throw new Error("Supabase is not configured.");
  if (!files.length) return [];

  const uploads = files.slice(0, maxWatchImages).map(async (file, index) => {
    const path = `${user.id}/${watchId}/${Date.now()}-${index}-${cleanFileName(file.name)}`;
    const { error } = await client.storage.from(watchImageBucket).upload(path, file, {
      cacheControl: "31536000",
      contentType: getImageContentType(file),
      upsert: false
    });

    if (error) throw new Error(`Image upload failed: ${error.message}`);

    return path;
  });

  return Promise.all(uploads);
}

export async function getOrCreateShareLink(user: User) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const existing = await supabase
    .from("watch_share_links")
    .select("token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if ((existing.data as ShareLinkRow | null)?.token) return (existing.data as ShareLinkRow).token;

  const created = await supabase
    .from("watch_share_links")
    .insert({ user_id: user.id })
    .select("token")
    .single();

  if (created.error) throw created.error;
  return (created.data as ShareLinkRow).token;
}

export async function loadSharedWishlist(token: string): Promise<Watch[]> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const apiWatches = await loadSharedWishlistFromApi(token);
  if (apiWatches) return apiWatches;

  const { data, error } = await supabase.rpc("get_shared_wishlist", {
    share_token: token
  });

  if (error) throw error;
  return ((data || []) as WatchRow[]).map(fromWatchRow);
}

function fromWatchRow(row: WatchRow, index: number): Watch {
  const rawImageUrls = normalizeImageUrls(row.image_urls, row.image_url);
  const externalImageUrls = rawImageUrls.filter((url) => !isStorageImageUrl(url));
  const legacyStoragePaths = rawImageUrls.map(getStorageImagePath).filter(Boolean);
  const imagePaths = normalizeImagePaths(row.image_paths, legacyStoragePaths);
  const imageUrls = normalizeImageUrls(externalImageUrls, null, makeWatchImage(row.category, index));

  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    category: row.category,
    status: row.status,
    movement: row.movement === "Quartz" ? "Quartz" : "Automatic",
    caseSize: Number(row.case_size_mm) || 0,
    price: Number(row.price) || 0,
    referenceNumber: row.reference_number || "",
    sourceUrl: row.source_url,
    imageUrl: imageUrls[0],
    imageUrls,
    imagePaths,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toWatchRow(user: User, watch: Watch): WatchRow {
  const rawImageUrls = normalizeImageUrls(watch.imageUrls, watch.imageUrl);
  const legacyStoragePaths = rawImageUrls.map(getStorageImagePath).filter(Boolean);
  const imageUrls = rawImageUrls
    .filter((url) => !url.startsWith("data:"))
    .filter((url) => !isStorageImageUrl(url))
    .slice(0, maxWatchImages);
  const imagePaths = normalizeImagePaths(watch.imagePaths, legacyStoragePaths);

  return {
    id: watch.id,
    user_id: user.id,
    brand: watch.brand,
    model: watch.model,
    category: watch.category,
    status: watch.status,
    movement: watch.movement,
    case_size_mm: watch.caseSize || null,
    price: watch.price,
    reference_number: watch.referenceNumber || null,
    source_url: watch.sourceUrl,
    image_url: imageUrls[0] || null,
    image_urls: imageUrls,
    image_paths: imagePaths,
    created_at: watch.createdAt,
    updated_at: new Date().toISOString()
  };
}

export async function signWatchImagePaths(paths: string[]) {
  const client = supabase;
  const imagePaths = normalizeImagePaths(paths);
  if (!client || !imagePaths.length) return [];

  const { data, error } = await client.storage.from(watchImageBucket).createSignedUrls(imagePaths, signedImageExpiresIn);
  if (error) throw new Error(`Image signing failed: ${error.message}`);

  return imagePaths.map((path, index) => data?.[index]?.signedUrl || data?.find((item) => item.path === path)?.signedUrl || "");
}

async function withSignedStorageImages(watches: Watch[]) {
  const paths = normalizeImagePaths(watches.flatMap((watch) => watch.imagePaths));
  if (!paths.length) return watches;

  const signedUrlMap = new Map<string, string>();
  const signedUrls = await signWatchImagePaths(paths);
  paths.forEach((path, index) => {
    if (signedUrls[index]) signedUrlMap.set(path, signedUrls[index]);
  });

  return watches.map((watch) => {
    const externalUrls = watch.imageUrls.filter((url) => !url.startsWith("data:"));
    const signedWatchUrls = watch.imagePaths.map((path) => signedUrlMap.get(path) || "").filter(Boolean);
    const imageUrls = normalizeImageUrls([...externalUrls, ...signedWatchUrls], null, makeWatchImage(watch.category, watch.id));

    return {
      ...watch,
      imageUrl: imageUrls[0],
      imageUrls
    };
  });
}

async function loadSharedWishlistFromApi(token: string) {
  try {
    const response = await fetch(`/api/shared-wishlist?token=${encodeURIComponent(token)}`, {
      headers: { accept: "application/json" }
    });
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) return null;
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body?.error || "Shared wishlist is unavailable.");
    }

    if (!Array.isArray(body?.watches)) return null;
    return (body.watches as WatchRow[]).map(fromWatchRow);
  } catch (error) {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return null;
    throw error;
  }
}

function cleanFileName(value: string) {
  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "watch-image";
}

function getImageContentType(file: File) {
  if (file.type) return file.type;
  return file.name.toLowerCase().endsWith(".avif") ? "image/avif" : undefined;
}
