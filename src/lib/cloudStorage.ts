import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { CabinetSnapshot, Watch, WatchCategory, WatchStatus } from "./types";
import { makeWatchImage } from "./watchImages";

interface WatchRow {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  category: WatchCategory;
  status: WatchStatus;
  price: number | string;
  source_url: string;
  image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SettingsRow {
  user_id: string;
  budget: number | string;
}

export async function loadCloudSnapshot(user: User): Promise<CabinetSnapshot> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const [watchesResult, settingsResult] = await Promise.all([
    supabase
      .from("watches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("watch_settings")
      .select("user_id,budget")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  if (watchesResult.error) throw watchesResult.error;
  if (settingsResult.error) throw settingsResult.error;

  return {
    watches: ((watchesResult.data || []) as WatchRow[]).map(fromWatchRow),
    filters: { tab: "all", category: "all", query: "" },
    budget: Number((settingsResult.data as SettingsRow | null)?.budget) || 6000
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

export async function saveCloudBudget(user: User, budget: number) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase
    .from("watch_settings")
    .upsert({ user_id: user.id, budget }, { onConflict: "user_id" });

  if (error) throw error;
}

function fromWatchRow(row: WatchRow, index: number): Watch {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    category: row.category,
    status: row.status,
    price: Number(row.price) || 0,
    sourceUrl: row.source_url,
    imageUrl: row.image_url || makeWatchImage(row.category, index),
    notes: row.notes || "",
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
    price: watch.price,
    source_url: watch.sourceUrl,
    image_url: watch.imageUrl && !watch.imageUrl.startsWith("data:") ? watch.imageUrl : null,
    notes: watch.notes || null,
    created_at: watch.createdAt,
    updated_at: new Date().toISOString()
  };
}
