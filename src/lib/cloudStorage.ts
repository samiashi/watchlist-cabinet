import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { CabinetSnapshot, Watch, WatchCategory, WatchMovement, WatchStatus } from "./types";
import { makeWatchImage } from "./watchImages";

interface WatchRow {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  category: WatchCategory;
  status: WatchStatus;
  movement: WatchMovement | null;
  case_size_mm: number | string | null;
  price: number | string;
  source_url: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
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

function fromWatchRow(row: WatchRow, index: number): Watch {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    category: row.category,
    status: row.status,
    movement: row.movement === "Quartz" ? "Quartz" : "Automatic",
    caseSize: Number(row.case_size_mm) || 0,
    price: Number(row.price) || 0,
    sourceUrl: row.source_url,
    imageUrl: row.image_url || makeWatchImage(row.category, index),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toWatchRow(user: User, watch: Watch): WatchRow {
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
    source_url: watch.sourceUrl,
    image_url: watch.imageUrl && !watch.imageUrl.startsWith("data:") ? watch.imageUrl : null,
    created_at: watch.createdAt,
    updated_at: new Date().toISOString()
  };
}
