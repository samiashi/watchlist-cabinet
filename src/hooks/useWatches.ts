import { useRef, useState } from "react";
import type { FormEvent, SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import {
  deleteCloudWatch,
  deleteWatchImages,
  getDisplayOrderForIndex,
  signWatchImagePaths,
  updateCloudWatchOrder,
  uploadWatchImages,
  upsertCloudWatch
} from "../lib/cloudStorage";
import { cleanText, createId, normalizeUrl } from "../lib/formatters";
import { maxWatchImages, type Watch, type WatchCategory, type WatchStatus } from "../lib/types";
import { normalizeImagePaths, normalizeImageUrls } from "../lib/watchImages";
import { formatCaseSize, getFormImageFiles, getFormImageOrder, getFormImageUploadIds, getStoredImageItems, normalizeMovement, sortWatchesByCustomOrder } from "./watchHelpers";

export function useWatches(cloudUser: User | null, showToast: (message: string) => void, confirmAction: (message: string) => Promise<boolean>) {
  const [watches, setWatchesState] = useState<Watch[]>([]);
  const watchesRef = useRef<Watch[]>(watches);
  const [isSavingWatch, setIsSavingWatch] = useState(false);
  const isSavingWatchRef = useRef(false);

  function setWatches(next: SetStateAction<Watch[]>) {
    setWatchesState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      watchesRef.current = resolved;
      return resolved;
    });
  }

  async function saveWatch(watch: Watch) {
    const previous = watches;
    setWatches((current) => {
      const exists = current.some((item) => item.id === watch.id);
      return exists
        ? current.map((item) => (item.id === watch.id ? watch : item))
        : [watch, ...current];
    });

    if (!cloudUser) return;

    try {
      await upsertCloudWatch(cloudUser, watch);
    } catch (error) {
      setWatches(previous);
      throw error;
    }
  }

  async function deleteWatch(id: string) {
    const watch = watches.find((item) => item.id === id);
    if (!watch) return false;

    const confirmed = await confirmAction(`Delete ${watch.brand} ${watch.model}?`);
    if (!confirmed) return false;

    const previous = watches;
    setWatches((current) => current.filter((item) => item.id !== id));

    try {
      if (cloudUser) {
        await deleteCloudWatch(cloudUser, id);
        if (watch.imagePaths.length) {
          void deleteWatchImages(watch.imagePaths, cloudUser.id).catch((error) => {
            console.warn("Could not delete watch images", error);
          });
        }
      }
      showToast("Watch deleted.");
      return true;
    } catch (error) {
      setWatches(previous);
      showToast(error instanceof Error ? error.message : "Watch was not deleted.");
      return false;
    }
  }

  async function reorderWatches(orderedVisibleIds: string[]) {
    const nextWatches = applyVisibleWatchOrder(watches, orderedVisibleIds);
    if (areWatchOrdersEqual(watches, nextWatches)) return;

    const previousWatches = watches;
    setWatches(nextWatches);

    if (!cloudUser) return;

    try {
      await updateCloudWatchOrder(cloudUser, nextWatches);
    } catch (error) {
      setWatches(previousWatches);
      showToast(error instanceof Error ? error.message : "Watch order was not saved.");
    }
  }

  async function handleWatchFormSubmit(event: FormEvent<HTMLFormElement>, editingId: string | null, closeDrawer: () => void) {
    event.preventDefault();
    if (isSavingWatchRef.current) return;

    isSavingWatchRef.current = true;
    setIsSavingWatch(true);

    let uploadedImagePaths: string[] = [];

    try {
      const form = new FormData(event.currentTarget);
      const existing = editingId ? watches.find((watch) => watch.id === editingId) : null;
      const id = existing?.id || createId();
      const category = String(form.get("category")) as WatchCategory;
      const brand = cleanText(form.get("brand"));
      const model = cleanText(form.get("model"));
      const sourceUrl = normalizeUrl(form.get("sourceUrl"));
      const imageOrder = getFormImageOrder(form);
      const imageFiles = getFormImageFiles(form);
      const previousImagePaths = existing ? getStoredImageItems(existing).map((image) => image.path) : [];
      const imageCount = imageOrder.length;

      if (!brand || !model || !sourceUrl) {
        showToast("Brand, model, and URL are required.");
        return;
      }

      if (imageCount > maxWatchImages) {
        showToast(`Keep images to ${maxWatchImages} or fewer.`);
        return;
      }

      if (imageFiles.length && !cloudUser) {
        showToast("Sign in with Google to upload watch images.");
        return;
      }

      if (imageFiles.length && cloudUser) {
        uploadedImagePaths = await uploadWatchImages(cloudUser, id, imageFiles);
      }

      const uploadedPathById = new Map(getFormImageUploadIds(form).map((uploadId, index) => [uploadId, uploadedImagePaths[index] || ""]));
      const imagePaths = normalizeImagePaths(
        imageOrder.map((value) => {
          if (value.startsWith("path:")) return value.slice(5);
          if (value.startsWith("upload:")) return uploadedPathById.get(value.slice(7)) || "";
          return "";
        })
      );
      const removedImagePaths = previousImagePaths.filter((path) => !imagePaths.includes(path));
      let signedImageUrls: string[] = [];

      if (imagePaths.length && cloudUser) {
        signedImageUrls = await signWatchImagePaths(imagePaths, cloudUser.id);
      }

      const allImageUrls = normalizeImageUrls(signedImageUrls, null);

      const watch: Watch = {
        id,
        brand,
        model,
        category,
        status: String(form.get("status")) as WatchStatus,
        movement: normalizeMovement(form.get("movement")),
        caseSize: Number(form.get("caseSize")) || 0,
        price: Number(form.get("price")) || 0,
        referenceNumber: cleanText(form.get("referenceNumber")),
        sourceUrl,
        imageUrl: allImageUrls[0],
        imageUrls: allImageUrls,
        imagePaths,
        displayOrder: existing?.displayOrder ?? getNewWatchDisplayOrder(watches),
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveWatch(watch);
      if (!existing && cloudUser && watch.displayOrder <= 0) {
        rebalanceWatchOrders();
      }
      if (removedImagePaths.length && cloudUser) {
        void deleteWatchImages(removedImagePaths, cloudUser.id).catch((error) => {
          console.warn("Could not delete removed watch images", error);
        });
      }
      closeDrawer();
      showToast(existing ? "Watch updated." : "Watch added.");
    } catch (error) {
      if (uploadedImagePaths.length && cloudUser) {
        void deleteWatchImages(uploadedImagePaths, cloudUser.id).catch((deleteError) => {
          console.warn("Could not clean up unsaved watch images", deleteError);
        });
      }
      showToast(error instanceof Error ? error.message : "Watch was not saved.");
    } finally {
      isSavingWatchRef.current = false;
      setIsSavingWatch(false);
    }
  }

  function rebalanceWatchOrders() {
    if (!cloudUser) return;

    const rebasedWatches = normalizeWatchDisplayOrders(sortWatchesByCustomOrder(watchesRef.current));
    setWatches(rebasedWatches);
    void updateCloudWatchOrder(cloudUser, rebasedWatches).catch((error) => {
      console.warn("Could not save the rebalanced watch order", error);
    });
  }

  return { watches, setWatches, saveWatch, deleteWatch, reorderWatches, handleWatchFormSubmit, isSavingWatch };
}

function applyVisibleWatchOrder(watches: Watch[], orderedVisibleIds: string[]) {
  const orderedIds = orderedVisibleIds.filter(Boolean);
  if (orderedIds.length < 2) return watches;

  const baseOrder = sortWatchesByCustomOrder(watches);
  const byId = new Map(baseOrder.map((watch) => [watch.id, watch]));
  const reorderedVisibleWatches = orderedIds.map((id) => byId.get(id)).filter((watch): watch is Watch => Boolean(watch));
  if (reorderedVisibleWatches.length !== orderedIds.length) return watches;

  const reorderedIdSet = new Set(orderedIds);
  let visibleIndex = 0;
  const nextWatches = baseOrder.map((watch) => (reorderedIdSet.has(watch.id) ? reorderedVisibleWatches[visibleIndex++] : watch));
  return normalizeWatchDisplayOrders(nextWatches);
}

function normalizeWatchDisplayOrders(watches: Watch[]) {
  return watches.map((watch, index) => ({
    ...watch,
    displayOrder: getDisplayOrderForIndex(index)
  }));
}

function getNewWatchDisplayOrder(watches: Watch[]) {
  if (!watches.length) return getDisplayOrderForIndex(0);
  const orders = watches.map((watch) => Number(watch.displayOrder)).filter(Number.isFinite);
  if (!orders.length) return getDisplayOrderForIndex(0);
  return Math.min(...orders) - 1000;
}

function areWatchOrdersEqual(left: Watch[], right: Watch[]) {
  if (left.length !== right.length) return false;
  const leftOrder = sortWatchesByCustomOrder(left).map((watch) => watch.id);
  const rightOrder = sortWatchesByCustomOrder(right).map((watch) => watch.id);
  return leftOrder.every((id, index) => id === rightOrder[index]);
}
