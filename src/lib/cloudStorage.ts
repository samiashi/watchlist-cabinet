import type { User } from "@supabase/supabase-js";
import { supabase, supabaseUrl } from "./supabase";
import { maxWatchImages, movements, type CabinetSnapshot, type Watch, type WatchCategory, type WatchMovement, type WatchStatus } from "./types";
import {
  getSignedUrl,
  isMissingDisplayOrderError,
  isMissingRpcError,
  isUserImagePath,
  signedImageExpiresIn,
  toAbsoluteStorageUrl,
  watchImageBucket
} from "../shared/watchStorage";
import { getStorageImagePath, isGeneratedWatchImage, isStorageImageUrl, normalizeAllImagePaths, normalizeImagePaths, normalizeImageUrls } from "./watchImages";

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
  display_order?: number | string | null;
  created_at: string;
  updated_at: string;
}

interface ShareLinkRow {
  token: string;
}

interface WatchRowOptions {
  keepStorageUrls?: boolean;
}

export async function loadCloudSnapshot(user: User): Promise<CabinetSnapshot> {
  if (!supabase) throw new Error("Supabase is not configured.");

  let watchesResult = await supabase
    .from("watches")
    .select("*")
    .eq("user_id", user.id)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (isMissingDisplayOrderError(watchesResult.error)) {
    watchesResult = await supabase
      .from("watches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
  }

  if (watchesResult.error) throw watchesResult.error;
  const watches = ((watchesResult.data || []) as WatchRow[])
    .map((row, index) => fromWatchRow(row, index))
    .map((watch) => ({ ...watch, imagePaths: watch.imagePaths.filter((path) => isUserImagePath(path, user.id)) }));

  return {
    watches: await withSignedStorageImages(watches, user.id),
    filters: { tab: "all", query: "", sort: "relevance" }
  };
}

export async function upsertCloudWatch(user: User, watch: Watch) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const row = toWatchRow(user, watch);
  const { error } = await supabase.from("watches").upsert(row, {
    onConflict: "id"
  });

  if (!isMissingDisplayOrderError(error)) {
    if (error) throw error;
    return;
  }

  const { display_order: _displayOrder, ...fallbackRow } = row;
  const fallbackResult = await supabase.from("watches").upsert(fallbackRow, {
    onConflict: "id"
  });

  if (fallbackResult.error) throw fallbackResult.error;
}

export async function updateCloudWatchOrder(user: User, watches: Watch[]) {
  const client = supabase;
  if (!client) throw new Error("Supabase is not configured.");

  const orders = watches.map((watch, index) => ({
    id: watch.id,
    display_order: getDisplayOrderForIndex(index)
  }));

  const { error } = await client.rpc("set_watch_display_order", { orders });

  if (!isMissingRpcError(error, "set_watch_display_order")) {
    if (error) throw error;
    return;
  }

  await updateCloudWatchOrderRowByRow(client, user, watches);
}

async function updateCloudWatchOrderRowByRow(client: typeof supabase, user: User, watches: Watch[]) {
  if (!client) return;

  const updatedAt = new Date().toISOString();
  const previousOrders = new Map(watches.map((watch) => [watch.id, watch.displayOrder]));
  const updatedIds: string[] = [];

  try {
    for (const [index, watch] of watches.entries()) {
      const result = await client
        .from("watches")
        .update({
          display_order: getDisplayOrderForIndex(index),
          updated_at: updatedAt
        })
        .eq("id", watch.id)
        .eq("user_id", user.id);

      if (isMissingDisplayOrderError(result.error)) {
        throw new Error("Run the Supabase display_order migration before saving custom watch order.");
      }
      if (result.error) throw result.error;
      updatedIds.push(watch.id);
    }
  } catch (error) {
    await Promise.all(
      updatedIds.map(async (id) => {
        const displayOrder = previousOrders.get(id);
        if (!Number.isFinite(displayOrder)) return;
        await client
          .from("watches")
          .update({ display_order: displayOrder, updated_at: updatedAt })
          .eq("id", id)
          .eq("user_id", user.id);
      })
    );
    throw error;
  }
}

export async function deleteCloudWatch(user: User, id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("watches").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
}

export async function uploadWatchImages(user: User, watchId: string, files: File[]) {
  const client = supabase;
  if (!client) throw new Error("Supabase is not configured.");
  if (!files.length) return [];

  const uploadedPaths: string[] = [];

  try {
    for (const [index, file] of files.slice(0, maxWatchImages).entries()) {
      const path = `${user.id}/${watchId}/${Date.now()}-${index}-${cleanFileName(file.name)}`;
      const { error } = await client.storage.from(watchImageBucket).upload(path, file, {
        cacheControl: "31536000",
        contentType: getImageContentType(file),
        upsert: false
      });

      if (error) throw new Error(`Image upload failed: ${error.message}`);
      uploadedPaths.push(path);
    }

    return uploadedPaths;
  } catch (error) {
    if (uploadedPaths.length) {
      await deleteWatchImages(uploadedPaths, user.id).catch((cleanupError) => {
        console.warn("Could not clean up partially uploaded watch images", cleanupError);
      });
    }
    throw error;
  }
}

export async function deleteWatchImages(paths: string[], ownerId?: string) {
  const client = supabase;
  const imagePaths = normalizeAllImagePaths(paths).filter((path) => !ownerId || isUserImagePath(path, ownerId));
  if (!client || !imagePaths.length) return;

  const { error } = await client.storage.from(watchImageBucket).remove(imagePaths);
  if (error) throw new Error(`Image cleanup failed: ${error.message}`);
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

export async function rotateShareLink(user: User) {
  const client = supabase;
  if (!client) throw new Error("Supabase is not configured.");

  const rotated = await client.rpc("rotate_share_link");
  const token = typeof rotated.data === "string" ? rotated.data : "";

  if (!rotated.error && token) return token;
  if (!isMissingRpcError(rotated.error, "rotate_share_link")) {
    throw rotated.error || new Error("Wishlist link could not be rotated.");
  }

  await client.from("watch_share_links").delete().eq("user_id", user.id);

  const created = await client
    .from("watch_share_links")
    .insert({ user_id: user.id })
    .select("token")
    .single();

  if (created.error) throw created.error;
  return (created.data as ShareLinkRow).token;
}

export async function deleteShareLink(user: User) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("watch_share_links").delete().eq("user_id", user.id);
  if (error) throw error;
}

export async function loadSharedWishlist(token: string): Promise<Watch[]> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const apiWatches = await loadSharedWishlistFromApi(token);
  if (apiWatches) return apiWatches;

  const { data, error } = await supabase.rpc("get_shared_wishlist", {
    share_token: token
  });

  if (error) throw error;
  return ((data || []) as WatchRow[]).map((row, index) => fromWatchRow(row, index));
}

function fromWatchRow(row: WatchRow, index: number, options: WatchRowOptions = {}): Watch {
  const rawImageUrls = normalizeImageUrls(row.image_urls, row.image_url);
  const externalImageUrls = rawImageUrls.filter((url) => !isGeneratedWatchImage(url) && (options.keepStorageUrls || !isStorageImageUrl(url)));
  const legacyStoragePaths = options.keepStorageUrls ? [] : rawImageUrls.map(getStorageImagePath).filter(Boolean);
  const imagePaths = normalizeImagePaths(row.image_paths, legacyStoragePaths);
  const imageUrls = normalizeImageUrls(externalImageUrls, null);

  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    category: row.category,
    status: row.status,
    movement: movements.includes(row.movement as WatchMovement) ? (row.movement as WatchMovement) : "Automatic",
    caseSize: Number(row.case_size_mm) || 0,
    price: Number(row.price) || 0,
    referenceNumber: row.reference_number || "",
    sourceUrl: row.source_url,
    imageUrl: imageUrls[0] || "",
    imageUrls,
    imagePaths,
    displayOrder: normalizeDisplayOrder(row.display_order, index),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toWatchRow(user: User, watch: Watch): WatchRow {
  const rawImageUrls = normalizeImageUrls(watch.imageUrls, watch.imageUrl);
  const legacyStoragePaths = rawImageUrls.map(getStorageImagePath).filter(Boolean);
  const imageUrls = rawImageUrls
    .filter((url) => !url.startsWith("data:"))
    .filter((url) => !isGeneratedWatchImage(url))
    .filter((url) => !isStorageImageUrl(url))
    .slice(0, maxWatchImages);
  const imagePaths = normalizeImagePaths(watch.imagePaths, legacyStoragePaths).filter((path) => isUserImagePath(path, user.id));

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
    display_order: watch.displayOrder,
    created_at: watch.createdAt,
    updated_at: new Date().toISOString()
  };
}

export async function signWatchImagePaths(paths: string[], ownerId?: string) {
  const client = supabase;
  const imagePaths = normalizeAllImagePaths(paths).filter((path) => !ownerId || isUserImagePath(path, ownerId));
  if (!client || !imagePaths.length) return [];

  const { data, error } = await client.storage.from(watchImageBucket).createSignedUrls(imagePaths, signedImageExpiresIn);
  if (error) throw new Error(`Image signing failed: ${error.message}`);

  return imagePaths.map((path, index) => {
    const indexedUrl = getSignedUrl(data?.[index]);
    const matchingUrl = indexedUrl || getSignedUrl(data?.find((item) => item.path === path));
    return toAbsoluteStorageUrl(matchingUrl, supabaseUrl);
  });
}

async function withSignedStorageImages(watches: Watch[], ownerId: string) {
  const paths = normalizeAllImagePaths(watches.flatMap((watch) => watch.imagePaths)).filter((path) => isUserImagePath(path, ownerId));
  if (!paths.length) return watches;

  const signedUrlMap = new Map<string, string>();
  const signedUrls = await signWatchImagePaths(paths);
  paths.forEach((path, index) => {
    if (signedUrls[index]) signedUrlMap.set(path, signedUrls[index]);
  });

  return watches.map((watch) => {
    const externalUrls = watch.imageUrls.filter((url) => !url.startsWith("data:"));
    const signedWatchUrls = watch.imagePaths
      .filter((path) => isUserImagePath(path, ownerId))
      .map((path) => signedUrlMap.get(path) || "")
      .filter(Boolean);
    const imageUrls = normalizeImageUrls([...externalUrls, ...signedWatchUrls], null);

    return {
      ...watch,
      imageUrl: imageUrls[0] || "",
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
    return (body.watches as WatchRow[]).map((row, index) => fromWatchRow(row, index, { keepStorageUrls: true }));
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

export function getDisplayOrderForIndex(index: number) {
  return (index + 1) * 1000;
}

function normalizeDisplayOrder(value: unknown, index: number) {
  const order = Number(value);
  return Number.isFinite(order) ? order : getDisplayOrderForIndex(index);
}
