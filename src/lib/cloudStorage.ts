import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { maxWatchImages, type CabinetSnapshot, type Watch, type WatchCategory, type WatchMovement, type WatchStatus } from "./types";
import { makeWatchImage, normalizeImageUrls } from "./watchImages";

const watchImageBucket = "watch-images";

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

  return {
    watches: ((watchesResult.data || []) as WatchRow[]).map(fromWatchRow),
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

    const { data } = client.storage.from(watchImageBucket).getPublicUrl(path);
    return data.publicUrl;
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

  const { data, error } = await supabase.rpc("get_shared_wishlist", {
    share_token: token
  });

  if (error) throw error;
  return ((data || []) as WatchRow[]).map(fromWatchRow);
}

function fromWatchRow(row: WatchRow, index: number): Watch {
  const imageUrls = normalizeImageUrls(row.image_urls, row.image_url, makeWatchImage(row.category, index));

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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toWatchRow(user: User, watch: Watch): WatchRow {
  const imageUrls = normalizeImageUrls(watch.imageUrls, watch.imageUrl)
    .filter((url) => !url.startsWith("data:"))
    .slice(0, maxWatchImages);

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
    created_at: watch.createdAt,
    updated_at: new Date().toISOString()
  };
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
