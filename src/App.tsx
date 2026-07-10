import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { DragDropProvider, DragOverlay, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowDownUp,
  Archive,
  BadgeCheck,
  Banknote,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Gem,
  GripVertical,
  Grid3X3,
  Heart,
  Hash,
  Images,
  Link as LinkIcon,
  Loader2,
  Mountain,
  Pencil,
  Plane,
  Plus,
  RotateCw,
  Ruler,
  Save,
  Search,
  Share2,
  ShoppingBag,
  Sun,
  Timer,
  Trash2,
  Upload,
  Watch as WatchIcon,
  Waves,
  X
} from "lucide-react";
import {
  deleteCloudWatch,
  deleteWatchImages,
  getDisplayOrderForIndex,
  getOrCreateShareLink,
  loadCloudSnapshot,
  loadSharedWishlist,
  signWatchImagePaths,
  updateCloudWatchOrder,
  uploadWatchImages,
  upsertCloudWatch
} from "./lib/cloudStorage";
import { cleanText, createId, formatCurrency, formatWatchCount, getDomain, normalizeUrl, sum } from "./lib/formatters";
import { loadLocalSnapshot, saveLocalSnapshot } from "./lib/localStorage";
import { reorderItems } from "./lib/reorderItems";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { categories, maxWatchImages, movements, type CabinetFilters, type CabinetSummary, type Watch, type WatchCategory, type WatchMovement, type WatchStatus } from "./lib/types";
import { getStorageImagePath, getWatchImages, makeWatchImage, normalizeImagePaths, normalizeImageUrls } from "./lib/watchImages";

const emptyFilters: CabinetFilters = { tab: "all", query: "", sort: "relevance" };
const siteUrl = import.meta.env.VITE_SITE_URL?.trim();
const pendingImageFiles = new Map<string, File>();

type DrawerState = { open: false; editingId: null } | { open: true; editingId: string | null };
type PreviewState = { watch: Watch; imageIndex: number };
type ManagedImage =
  | { id: string; kind: "stored"; path: string; url: string }
  | { id: string; kind: "upload"; file: File; url: string };

function App() {
  const shareToken = getShareTokenFromPath();
  return shareToken ? <SharedWishlistPage token={shareToken} /> : <CabinetApp />;
}

function CabinetApp() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [filters, setFilters] = useState<CabinetFilters>(emptyFilters);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, editingId: null });
  const [previewWatch, setPreviewWatch] = useState<PreviewState | null>(null);
  const [toast, setToast] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [isSavingWatch, setIsSavingWatch] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const toastTimer = useRef<number | null>(null);
  const isSavingWatchRef = useRef(false);
  const cloudUser = session?.user || null;

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      const snapshot = loadLocalSnapshot();
      setWatches(snapshot.watches);
      setFilters(snapshot.filters);
      setIsLoaded(true);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) setAuthMessage("");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash);
    const errorDescription = searchParams.get("error_description") || hashParams.get("error_description");

    if (!errorDescription) return;

    setAuthMessage(errorDescription.replace(/\+/g, " "));
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  useEffect(() => {
    if (!isLoaded || isSupabaseConfigured) return;
    saveLocalSnapshot({ watches, filters });
  }, [filters, isLoaded, watches]);

  useEffect(() => {
    if (!isLoaded || !cloudUser) return;

    let active = true;
    setAuthMessage("");

    loadCloudSnapshot(cloudUser)
      .then((snapshot) => {
        if (!active) return;
        setWatches(snapshot.watches);
        setFilters(snapshot.filters);
      })
      .catch((error: Error) => {
        if (!active) return;
        showToast(`Could not load Supabase data: ${error.message}`);
      });

    return () => {
      active = false;
    };
  }, [cloudUser, isLoaded]);

  const summary = useMemo(() => getSummary(watches), [watches]);
  const filteredWatches = useMemo(() => getFilteredWatches(watches, filters), [filters, watches]);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  async function signInWithGoogle() {
    if (!supabase) return;

    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirectUrl(),
        queryParams: {
          prompt: "select_account"
        }
      }
    });

    if (error) {
      setAuthMessage("Google sign-in could not start.");
    }
  }

  async function shareWishlist() {
    if (!cloudUser) {
      showToast("Sign in with Google to share your wishlist.");
      return;
    }

    setIsSharing(true);
    try {
      const token = await getOrCreateShareLink(cloudUser);
      const url = `${getAppBaseUrl()}/share/${token}`;
      await copyShareUrl(url);
      showToast("Wishlist link copied.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Wishlist link was not created.");
    } finally {
      setIsSharing(false);
    }
  }

  function updateFilters(nextFilters: Partial<CabinetFilters>) {
    setFilters((current) => ({ ...current, ...nextFilters }));
  }

  function openDrawer(editingId: string | null = null) {
    setDrawer({ open: true, editingId });
  }

  function closeDrawer() {
    setDrawer({ open: false, editingId: null });
  }

  async function saveWatch(watch: Watch) {
    setWatches((current) => {
      const exists = current.some((item) => item.id === watch.id);
      return exists
        ? current.map((item) => (item.id === watch.id ? watch : item))
        : [watch, ...current];
    });

    if (cloudUser) {
      await upsertCloudWatch(cloudUser, watch);
    }
  }

  async function reorderWatches(orderedVisibleIds: string[]) {
    if (filters.sort !== "relevance" || filters.query.trim()) return;

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

  async function handleWatchFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSavingWatchRef.current) return;

    isSavingWatchRef.current = true;
    setIsSavingWatch(true);

    try {
      const form = new FormData(event.currentTarget);
      const editingId = drawer.editingId;
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

      let uploadedImagePaths: string[] = [];

      if (imageFiles.length && cloudUser) {
        try {
          uploadedImagePaths = await uploadWatchImages(cloudUser, id, imageFiles);
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Images were not uploaded.");
          return;
        }
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
        try {
          signedImageUrls = await signWatchImagePaths(imagePaths);
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Images were not prepared.");
          return;
        }
      }

      const allImageUrls = normalizeImageUrls(signedImageUrls, null, makeWatchImage(category, id));

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

      try {
        await saveWatch(watch);
        if (removedImagePaths.length) {
          void deleteWatchImages(removedImagePaths).catch((error) => {
            console.warn("Could not delete removed watch images", error);
          });
        }
        closeDrawer();
        showToast(existing ? "Watch updated." : "Watch added.");
      } catch (error) {
        if (uploadedImagePaths.length) {
          void deleteWatchImages(uploadedImagePaths).catch((deleteError) => {
            console.warn("Could not clean up unsaved watch images", deleteError);
          });
        }
        showToast(error instanceof Error ? error.message : "Watch was not saved.");
      }
    } finally {
      isSavingWatchRef.current = false;
      setIsSavingWatch(false);
    }
  }

  async function deleteWatch(id: string) {
    const watch = watches.find((item) => item.id === id);
    if (!watch) return false;
    const confirmed = window.confirm(`Delete ${watch.brand} ${watch.model}?`);
    if (!confirmed) return false;

    const previous = watches;
    setWatches((current) => current.filter((item) => item.id !== id));

    try {
      if (cloudUser) {
        await deleteCloudWatch(id);
        if (watch.imagePaths.length) {
          void deleteWatchImages(watch.imagePaths).catch((error) => {
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

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  if (isSupabaseConfigured && !session) {
    return <AuthGate message={authMessage} onSignIn={signInWithGoogle} />;
  }

  return (
    <div className="app-shell">
      <main className="workspace">
        <Topbar
          filters={filters}
          canShare={Boolean(cloudUser)}
          isSharing={isSharing}
          onAdd={() => openDrawer()}
          onShare={shareWishlist}
          onQueryChange={(query) => updateFilters({ query })}
        />
        <MobileSummary summary={summary} />
        <div className="content-grid">
          <Board
            watches={filteredWatches}
            filters={filters}
            canReorder={filters.sort === "relevance" && !filters.query.trim()}
            onFilterChange={updateFilters}
            onPreview={(watch, imageIndex = 0) => setPreviewWatch({ watch, imageIndex })}
            onReorder={reorderWatches}
          />
        </div>
      </main>
      {drawer.open ? (
        <WatchDrawer
          editing={drawer.editingId ? watches.find((watch) => watch.id === drawer.editingId) || null : null}
          filters={filters}
          isSubmitting={isSavingWatch}
          onClose={closeDrawer}
          onSubmit={handleWatchFormSubmit}
        />
      ) : null}
      {previewWatch ? (
        <ImagePreview
          watch={previewWatch.watch}
          initialImageIndex={previewWatch.imageIndex}
          onClose={() => setPreviewWatch(null)}
          onEdit={(id) => {
            setPreviewWatch(null);
            openDrawer(id);
          }}
          onDelete={async (id) => {
            const deleted = await deleteWatch(id);
            if (deleted) setPreviewWatch(null);
          }}
        />
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function SharedWishlistPage({ token }: { token: string }) {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [previewWatch, setPreviewWatch] = useState<PreviewState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const wishlistTotal = useMemo(() => sum(watches.map((watch) => Number(watch.price) || 0)), [watches]);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setError("Wishlist sharing needs Supabase configuration.");
      setIsLoading(false);
      return;
    }

    loadSharedWishlist(token)
      .then((sharedWatches) => {
        if (!active) return;
        setWatches(sharedWatches);
        setError("");
      })
      .catch(() => {
        if (!active) return;
        setError("This wishlist link is not available.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="app-shell">
      <main className="workspace shared-workspace">
        <header className="shared-header">
          <div className="shared-brand">
            <div className="brand-mark" aria-hidden="true">
              <WatchIcon size={20} />
            </div>
            <div>
              <h1 className="shared-title">Wishlist</h1>
              <p className="shared-meta">Shared from Cabinet</p>
            </div>
          </div>
          <div className="shared-total">
            <span>{formatWatchCount(watches.length)}</span>
            <strong>{formatCurrency(wishlistTotal)}</strong>
          </div>
        </header>

        <section className="board shared-board" aria-label="Shared wishlist">
          {isLoading ? (
            <div className="empty-state">
              <div>
                <Loader2 className="spin" size={36} />
                <h2>Loading wishlist</h2>
              </div>
            </div>
          ) : error ? (
            <div className="empty-state">
              <div>
                <WatchIcon size={44} />
                <h2>Wishlist unavailable</h2>
                <p>{error}</p>
              </div>
            </div>
          ) : watches.length ? (
            <div className="watch-grid" aria-label="Wishlist watches">
              {watches.map((watch, index) => (
                <WatchRow watch={watch} index={index} key={watch.id} onPreview={(item, imageIndex = 0) => setPreviewWatch({ watch: item, imageIndex })} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div>
                <Heart size={44} />
                <h2>No wishlist watches yet</h2>
                <p>This shared wishlist is empty.</p>
              </div>
            </div>
          )}
        </section>
      </main>
      {previewWatch ? (
        <ImagePreview
          watch={previewWatch.watch}
          initialImageIndex={previewWatch.imageIndex}
          onClose={() => setPreviewWatch(null)}
        />
      ) : null}
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="auth-shell" aria-label="Loading cabinet">
      <div className="auth-card">
        <Loader2 className="spin" size={24} aria-hidden="true" />
        <h1>Loading Cabinet</h1>
      </div>
    </main>
  );
}

function getAuthRedirectUrl() {
  return getAppBaseUrl();
}

function getAppBaseUrl() {
  return (siteUrl || window.location.origin).replace(/\/+$/, "");
}

function getShareTokenFromPath() {
  const match = window.location.pathname.match(/^\/share\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function copyShareUrl(url: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  window.prompt("Copy wishlist link", url);
}

function AuthGate({ message, onSignIn }: { message: string; onSignIn: () => Promise<void> }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signIn() {
    setIsSubmitting(true);
    await onSignIn();
    setIsSubmitting(false);
  }

  return (
    <main className="auth-shell" aria-label="Sign in">
      <section className="auth-card">
        <div className="brand-mark" aria-hidden="true">
          <WatchIcon size={21} />
        </div>
        <div>
          <h1>Cabinet</h1>
          <p>Sign in with Google to sync the watch list on your phone.</p>
        </div>
        <button className="button button-google" type="button" onClick={signIn} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="spin" size={16} /> : <GoogleMark />}
          <span>Continue with Google</span>
        </button>
        {message ? <p className="auth-message">{message}</p> : null}
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34a853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#fbbc05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.54 1 10.22 1 12s.43 3.46 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#ea4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function Topbar({
  filters,
  canShare,
  isSharing,
  onAdd,
  onShare,
  onQueryChange
}: {
  filters: CabinetFilters;
  canShare: boolean;
  isSharing: boolean;
  onAdd: () => void;
  onShare: () => void;
  onQueryChange: (query: string) => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <h1 className="page-title">Cabinet</h1>
        <div className="topbar-mobile-actions">
          {canShare ? (
            <button className="button button-icon mobile-share-button" type="button" onClick={onShare} disabled={isSharing} aria-label="Share wishlist">
              {isSharing ? <Loader2 className="spin" size={17} /> : <Share2 size={17} />}
            </button>
          ) : null}
          <button className="button button-primary mobile-add-button" type="button" onClick={onAdd}>
            <Plus size={17} />
            <span>Add</span>
          </button>
        </div>
      </div>
      <div className="topbar-controls">
        <label className="search-box">
          <span className="sr-only">Search watches</span>
          <Search size={18} aria-hidden="true" />
          <input
            id="searchInput"
            type="search"
            value={filters.query}
            placeholder="Search"
            autoComplete="off"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        {canShare ? (
          <button className="button topbar-desktop-action" type="button" onClick={onShare} disabled={isSharing}>
            {isSharing ? <Loader2 className="spin" size={17} /> : <Share2 size={17} />}
            <span>Share</span>
          </button>
        ) : null}
        <button className="button button-primary topbar-desktop-action" type="button" onClick={onAdd}>
          <Plus size={18} />
          <span>Add watch</span>
        </button>
      </div>
    </header>
  );
}

function MobileSummary({ summary }: { summary: CabinetSummary }) {
  return (
    <section className="mobile-summary-card" aria-label="Cost summary">
      <div className="mobile-summary-grid">
        <div className="mobile-total-cell is-wishlist">
          <span>
            <ShoppingBag size={14} />
            Wishlist
          </span>
          <strong>{formatCurrency(summary.wishlistTotal)}</strong>
          <small>{formatWatchCount(summary.wishlistCount)}</small>
        </div>
        <div className="mobile-total-cell is-owned">
          <span>
            <BadgeCheck size={14} />
            Owned
          </span>
          <strong>{formatCurrency(summary.ownedValue)}</strong>
          <small>{formatWatchCount(summary.ownedCount)}</small>
        </div>
      </div>
    </section>
  );
}

function StatusTabs({ tab, onChange }: { tab: CabinetFilters["tab"]; onChange: (tab: CabinetFilters["tab"]) => void }) {
  const tabOptions = [
    { id: "all", label: "All", icon: Grid3X3 },
    { id: "wishlist", label: "Wishlist", icon: Heart },
    { id: "owned", label: "Owned", icon: BadgeCheck }
  ] as const;

  return (
    <div className="tabs" role="tablist" aria-label="Status">
      {tabOptions.map((option) => (
        <button
          className={`tab ${tab === option.id ? "is-active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === option.id}
          key={option.id}
          onClick={() => onChange(option.id)}
        >
          <option.icon size={15} />
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SortSelect({ sort, onChange }: { sort: CabinetFilters["sort"]; onChange: (sort: CabinetFilters["sort"]) => void }) {
  return (
    <label className="sort-control">
      <ArrowDownUp size={14} aria-hidden="true" />
      <span className="sr-only">Sort watches</span>
      <select value={sort} onChange={(event) => onChange(event.target.value as CabinetFilters["sort"])} aria-label="Sort watches">
        <option value="relevance">Custom order</option>
        <option value="price-desc">Price high to low</option>
        <option value="price-asc">Price low to high</option>
      </select>
    </label>
  );
}

function Board({
  watches,
  filters,
  canReorder,
  onFilterChange,
  onPreview,
  onReorder
}: {
  watches: Watch[];
  filters: CabinetFilters;
  canReorder: boolean;
  onFilterChange: (filters: Partial<CabinetFilters>) => void;
  onPreview: (watch: Watch, imageIndex?: number) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const visibleOrder = useMemo(() => watches.map((watch) => watch.id), [watches]);

  function finishReorder(event: DragEndEvent) {
    setDraggingId(null);
    if (event.canceled) return;

    const { source } = event.operation;
    if (!isSortable(source) || source.initialIndex === source.index) return;

    onReorder(reorderItems(visibleOrder, source.initialIndex, source.index));
  }

  return (
    <section className="board" aria-label="Watch collection">
      <div className="board-header">
        <div>
          <h2 className="section-title">Collection</h2>
          <p className="section-meta">{canReorder ? "Drag cards to set the default order" : `${formatWatchCount(watches.length)} saved`}</p>
        </div>
        <div className="collection-controls">
          <StatusTabs tab={filters.tab} onChange={(tab) => onFilterChange({ tab })} />
          <SortSelect sort={filters.sort} onChange={(sort) => onFilterChange({ sort })} />
        </div>
      </div>
      <DragDropProvider
        onDragStart={({ operation }) => setDraggingId(operation.source ? String(operation.source.id) : null)}
        onDragEnd={finishReorder}
      >
        {watches.length ? (
          <div className={`watch-grid ${draggingId ? "is-reordering" : ""}`} aria-label="Watches">
            {watches.map((watch, index) => (
              <SortableWatchRow watch={watch} index={index} key={watch.id} onPreview={onPreview} canReorder={canReorder} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
        <DragOverlay className="drag-overlay" dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {(source) => {
            const watch = watches.find((item) => item.id === String(source.id));
            return watch ? <WatchRow watch={watch} index={0} onPreview={() => undefined} isDragOverlay /> : null;
          }}
        </DragOverlay>
      </DragDropProvider>
    </section>
  );
}

function SortableWatchRow({
  watch,
  index,
  onPreview,
  canReorder
}: {
  watch: Watch;
  index: number;
  onPreview: (watch: Watch, imageIndex?: number) => void;
  canReorder: boolean;
}) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: watch.id,
    index,
    disabled: !canReorder,
    transition: {
      duration: 220,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      idle: true
    }
  });

  return (
    <WatchRow
      watch={watch}
      index={index}
      onPreview={onPreview}
      canReorder={canReorder}
      isDragPlaceholder={isDragSource}
      rowRef={ref}
      handleRef={handleRef}
    />
  );
}

function WatchRow({
  watch,
  index,
  onPreview,
  canReorder = false,
  isDragPlaceholder = false,
  isDragOverlay = false,
  rowRef,
  handleRef
}: {
  watch: Watch;
  index: number;
  onPreview: (watch: Watch, imageIndex?: number) => void;
  canReorder?: boolean;
  isDragPlaceholder?: boolean;
  isDragOverlay?: boolean;
  rowRef?: (element: HTMLElement | null) => void;
  handleRef?: (element: HTMLButtonElement | null) => void;
}) {
  const statusLabel = watch.status === "owned" ? "Owned" : "Wishlist";
  const primaryImage = getWatchImages(watch)[0] || makeWatchImage(watch.category, watch.id);

  return (
    <article
      ref={rowRef}
      className={`watch-row is-${watch.status} ${isDragPlaceholder ? "is-drag-placeholder" : ""} ${
        isDragOverlay ? "is-drag-overlay-card" : ""
      }`}
      data-watch-id={watch.id}
    >
      {canReorder ? (
        <button
          ref={handleRef}
          className="reorder-handle"
          type="button"
          aria-label={`Reorder ${watch.brand} ${watch.model}`}
        >
          <GripVertical size={15} />
        </button>
      ) : null}
      <div className="shelf-visual">
        <div className="row-thumb">
          <button
            className="row-thumb-open"
            type="button"
            onClick={() => onPreview(watch, 0)}
            aria-label={`View larger image of ${watch.brand} ${watch.model}`}
          >
            <img
              className="watch-image"
              src={primaryImage}
              alt={`${watch.brand} ${watch.model}`}
              onError={(event) => {
                event.currentTarget.src = makeWatchImage(watch.category, index);
              }}
            />
          </button>
        </div>
      </div>
      <div className="watch-copy">
        <div className="watch-topline">
          <div>
            <div className="watch-kicker">{watch.brand}</div>
            <h3 className="watch-name">{watch.model}</h3>
          </div>
          <div className="price">
            <Banknote size={16} />
            {formatCurrency(watch.price)}
          </div>
          <div className="watch-specs">
            <span>
              <RotateCw size={13} />
              {watch.movement}
            </span>
            {watch.caseSize ? (
              <span>
                <Ruler size={13} />
                {formatCaseSize(watch.caseSize)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="row-meta">
          <span className="category-label">
            <CategoryGlyph category={watch.category} size={13} />
            {watch.category}
          </span>
          <span className={`status-badge is-${watch.status}`}>
            {watch.status === "owned" ? <Check size={13} /> : <Clock size={13} />}
            {statusLabel}
          </span>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div>
        <WatchIcon size={44} />
        <h2>No watches match this view</h2>
        <p>Add a watch or loosen the filters to rebuild the cabinet view.</p>
      </div>
    </div>
  );
}

function ImagePreview({
  watch,
  initialImageIndex = 0,
  onClose,
  onEdit,
  onDelete
}: {
  watch: Watch;
  initialImageIndex?: number;
  onClose: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
}) {
  const images = getWatchImages(watch);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const imageUrl = images[selectedImageIndex] || images[0] || makeWatchImage(watch.category, watch.id);
  const sourceDomain = getDomain(watch.sourceUrl);
  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    setSelectedImageIndex(clampImageIndex(initialImageIndex, images.length));
  }, [images.length, initialImageIndex, watch.id]);

  function showPreviewImage(step: number) {
    setSelectedImageIndex((current) => getWrappedImageIndex(current, images.length, step));
  }

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasMultipleImages) showPreviewImage(-1);
      if (event.key === "ArrowRight" && hasMultipleImages) showPreviewImage(1);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [hasMultipleImages, images.length, onClose]);

  return (
    <div
      className="image-preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${watch.brand} ${watch.model} image preview`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="image-preview-dialog">
        <div className="image-preview-header">
          <div>
            <p>{watch.brand}</p>
            <h2>{watch.model}</h2>
          </div>
          <div className="image-preview-actions">
            <a className="preview-source-link" href={normalizeUrl(watch.sourceUrl)} target="_blank" rel="noreferrer">
              <LinkIcon size={13} />
              <span>{sourceDomain}</span>
            </a>
            {onEdit ? (
              <button className="button button-icon" type="button" onClick={() => onEdit(watch.id)} title="Edit watch" aria-label="Edit watch">
                <Pencil size={16} />
              </button>
            ) : null}
            {onDelete ? (
              <button
                className="button button-icon button-danger"
                type="button"
                onClick={() => onDelete(watch.id)}
                title="Delete watch"
                aria-label="Delete watch"
              >
                <Trash2 size={16} />
              </button>
            ) : null}
            <button className="button button-icon" type="button" onClick={onClose} aria-label="Close image preview">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="image-preview-stage">
          <div
            className="image-preview-frame"
            onTouchStart={(event) => {
              if (hasMultipleImages) touchStartX.current = event.changedTouches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              if (!hasMultipleImages || touchStartX.current === null) return;
              const delta = touchStartX.current - (event.changedTouches[0]?.clientX ?? touchStartX.current);
              touchStartX.current = null;
              if (Math.abs(delta) < 36) return;
              event.preventDefault();
              showPreviewImage(delta > 0 ? 1 : -1);
            }}
          >
            <img
              src={imageUrl}
              alt={`${watch.brand} ${watch.model}`}
              onError={(event) => {
                event.currentTarget.src = makeWatchImage(watch.category, watch.id);
              }}
            />
            {hasMultipleImages ? (
              <>
                <button className="preview-nav is-prev" type="button" onClick={() => showPreviewImage(-1)} aria-label="Previous image">
                  <ChevronLeft size={22} />
                </button>
                <button className="preview-nav is-next" type="button" onClick={() => showPreviewImage(1)} aria-label="Next image">
                  <ChevronRight size={22} />
                </button>
                <div className="image-preview-counter">
                  {selectedImageIndex + 1}/{images.length}
                </div>
              </>
            ) : null}
          </div>
          {hasMultipleImages ? (
            <div className="image-preview-thumbs" aria-label="Watch images">
              {images.map((image, index) => (
                <button
                  className={`image-preview-thumb ${selectedImageIndex === index ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  aria-label={`Show image ${index + 1} of ${images.length}`}
                  aria-pressed={selectedImageIndex === index}
                  key={`${image}-${index}`}
                >
                  <img
                    src={image}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = makeWatchImage(watch.category, index);
                    }}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WatchDrawer({
  editing,
  filters,
  isSubmitting,
  onClose,
  onSubmit
}: {
  editing: Watch | null;
  filters: CabinetFilters;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const watch = editing || {
    brand: "",
    model: "",
    category: "Dress",
    status: filters.tab === "owned" ? "owned" : "wishlist",
    movement: "Automatic",
    caseSize: "",
    price: "",
    referenceNumber: "",
    sourceUrl: "",
    imageUrl: "",
    imageUrls: [],
    imagePaths: [],
    displayOrder: 1000
  };
  const initialImages = editing ? getStoredImageItems(editing) : [];

  return (
    <div
      className="drawer-backdrop"
      onClick={(event) => {
        if (isSubmitting) return;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="drawer" id="watchForm" aria-label={editing ? "Edit watch" : "Add watch"} onSubmit={onSubmit}>
        <div className="drawer-header">
          <h2 className="drawer-title">{editing ? "Edit watch" : "Add watch"}</h2>
          <button className="button button-icon" type="button" onClick={onClose} disabled={isSubmitting} aria-label="Close drawer">
            <X size={18} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="field is-wide">
            <label htmlFor="sourceUrl">
              <LinkIcon size={15} />
              Watch page URL
            </label>
            <input id="sourceUrl" name="sourceUrl" type="url" defaultValue={watch.sourceUrl} placeholder="https://shop.example.com/watch-page" required />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="brand">
                <BadgeCheck size={15} />
                Brand
              </label>
              <input id="brand" name="brand" defaultValue={watch.brand} placeholder="Omega" required />
            </div>
            <div className="field">
              <label htmlFor="model">
                <WatchIcon size={15} />
                Model
              </label>
              <input id="model" name="model" defaultValue={watch.model} placeholder="Speedmaster" required />
            </div>
            <div className="field">
              <label htmlFor="referenceNumber">
                <Hash size={15} />
                Reference
              </label>
              <input id="referenceNumber" name="referenceNumber" defaultValue={watch.referenceNumber} placeholder="SPB143J1" />
            </div>
            <div className="field">
              <label htmlFor="category">
                <Grid3X3 size={15} />
                Category
              </label>
              <select id="category" name="category" defaultValue={watch.category}>
                {categories.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="status">
                <Heart size={15} />
                Status
              </label>
              <select id="status" name="status" defaultValue={watch.status}>
                <option value="wishlist">Wishlist</option>
                <option value="owned">Owned</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="movement">
                <RotateCw size={15} />
                Movement
              </label>
              <select id="movement" name="movement" defaultValue={watch.movement}>
                {movements.map((movement) => (
                  <option value={movement} key={movement}>
                    {movement}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="caseSize">
                <Ruler size={15} />
                Case size
              </label>
              <input
                id="caseSize"
                name="caseSize"
                type="number"
                min="0"
                step="0.1"
                defaultValue={watch.caseSize ? String(watch.caseSize) : ""}
                placeholder="40"
                inputMode="decimal"
              />
            </div>
            <div className="field">
              <label htmlFor="price">
                <Banknote size={15} />
                Price (AED)
              </label>
              <input id="price" name="price" type="number" min="0" step="1" defaultValue={String(watch.price ?? "")} placeholder="9200" inputMode="decimal" required />
            </div>
            <div className="field is-wide">
              <label>
                <Images size={15} />
                Images
              </label>
              <ImageManager initialImages={initialImages} />
              <p className="field-help">Uploaded files stay private and are shown through short-lived signed URLs.</p>
            </div>
          </div>
        </div>
        <div className="drawer-footer">
          <button className="button" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            <span>{isSubmitting ? "Saving..." : editing ? "Save changes" : "Add watch"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function ImageManager({ initialImages }: { initialImages: ManagedImage[] }) {
  const [images, setImages] = useState<ManagedImage[]>(initialImages);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imagesRef = useRef(images);
  const remainingSlots = maxWatchImages - images.length;

  useEffect(() => {
    imagesRef.current = images;
    const input = fileInputRef.current;
    if (!input || typeof DataTransfer === "undefined") return;

    const transfer = new DataTransfer();
    images.forEach((image) => {
      if (image.kind === "upload") transfer.items.add(image.file);
    });
    input.files = transfer.files;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => {
        if (image.kind === "upload") {
          pendingImageFiles.delete(image.id);
          URL.revokeObjectURL(image.url);
        }
      });
    };
  }, []);

  function addFiles(fileList: FileList | null) {
    const files = Array.from(fileList || [])
      .filter((file) => file.size > 0)
      .slice(0, remainingSlots);

    if (!files.length) return;

    const createdAt = Date.now();
    const nextImages = files.map((file, index) => {
      const id = `upload-${createdAt}-${index}-${file.name}-${file.size}`;
      pendingImageFiles.set(id, file);
      return {
        id,
        kind: "upload" as const,
        file,
        url: URL.createObjectURL(file)
      };
    });

    setImages((current) => [...current, ...nextImages]);
  }

  function moveImage(index: number, step: number) {
    setImages((current) => {
      const nextIndex = index + step;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function removeImage(index: number) {
    setImages((current) => {
      const image = current[index];
      if (image?.kind === "upload") {
        pendingImageFiles.delete(image.id);
        URL.revokeObjectURL(image.url);
      }
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  return (
    <div className="image-manager">
      {images.map((image) => (
        <input
          type="hidden"
          name="imageOrder"
          value={image.kind === "stored" ? `path:${image.path}` : `upload:${image.id}`}
          key={`order-${image.id}`}
        />
      ))}
      {images
        .filter((image) => image.kind === "upload")
        .map((image) => (
          <input type="hidden" name="imageUploadIds" value={image.id} key={`upload-${image.id}`} />
        ))}

      {images.length ? (
        <div className="managed-image-list" aria-label="Selected images">
          {images.map((image, index) => (
            <div className="managed-image-item" key={image.id}>
              <img className="managed-image-preview" src={image.url} alt="" />
              <div className="managed-image-copy">
                <strong>Image {index + 1}</strong>
                <span>{image.kind === "stored" ? "Saved" : image.file.name}</span>
              </div>
              <div className="managed-image-actions">
                <button className="image-action" type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} aria-label={`Move image ${index + 1} up`}>
                  <ChevronUp size={15} />
                </button>
                <button
                  className="image-action"
                  type="button"
                  onClick={() => moveImage(index, 1)}
                  disabled={index === images.length - 1}
                  aria-label={`Move image ${index + 1} down`}
                >
                  <ChevronDown size={15} />
                </button>
                <button className="image-action is-danger" type="button" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="managed-image-empty">
          <Images size={18} />
          <span>No images added yet</span>
        </div>
      )}

      <label className={`upload-target ${remainingSlots <= 0 ? "is-disabled" : ""}`} htmlFor="imageFiles">
        <Upload size={16} />
        <span>{remainingSlots > 0 ? `Upload images (${remainingSlots} left)` : "Image limit reached"}</span>
      </label>
      <input
        ref={fileInputRef}
        className="image-file-input"
        id="imageFiles"
        name="imageFiles"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        multiple
        disabled={remainingSlots <= 0}
        onChange={(event) => {
          addFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function CategoryGlyph({ category, size = 14 }: { category: WatchCategory; size?: number }) {
  const Icon =
    category === "Dress"
      ? Gem
      : category === "Diver"
        ? Waves
        : category === "Field"
          ? Mountain
          : category === "Chronograph"
            ? Timer
            : category === "GMT"
              ? Clock
              : category === "Pilot"
                ? Plane
                : category === "Vintage"
                  ? Archive
                : Sun;

  return <Icon size={size} aria-hidden="true" />;
}

function getStoredImageItems(watch: Watch): Extract<ManagedImage, { kind: "stored" }>[] {
  const imageUrlByPath = new Map<string, string>();
  getWatchImages(watch).forEach((url) => {
    const path = getStorageImagePath(url);
    if (path) imageUrlByPath.set(path, url);
  });

  return normalizeImagePaths(watch.imagePaths, [...imageUrlByPath.keys()]).map((path) => ({
    id: `stored-${path}`,
    kind: "stored",
    path,
    url: imageUrlByPath.get(path) || makeWatchImage(watch.category, watch.id)
  }));
}

function getFormImageOrder(form: FormData) {
  return form
    .getAll("imageOrder")
    .filter((value): value is string => typeof value === "string")
    .filter((value) => value.startsWith("path:") || value.startsWith("upload:"))
    .slice(0, maxWatchImages);
}

function getFormImageUploadIds(form: FormData) {
  return form
    .getAll("imageUploadIds")
    .filter((value): value is string => typeof value === "string" && value.startsWith("upload-"))
    .slice(0, maxWatchImages);
}

function getFormImageFiles(form: FormData) {
  return getFormImageUploadIds(form)
    .map((uploadId) => pendingImageFiles.get(uploadId))
    .filter((file): file is File => Boolean(file && file.size > 0))
    .slice(0, maxWatchImages);
}

function clampImageIndex(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(Number(value) || 0, 0), total - 1);
}

function getWrappedImageIndex(current: number, total: number, step: number) {
  if (total <= 1) return 0;
  return (clampImageIndex(current, total) + step + total) % total;
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

function getSummary(watches: Watch[]): CabinetSummary {
  const owned = watches.filter((watch) => watch.status === "owned");
  const wishlist = watches.filter((watch) => watch.status === "wishlist");
  const wishlistTotal = sum(wishlist.map((watch) => Number(watch.price) || 0));
  const ownedValue = sum(owned.map((watch) => Number(watch.price) || 0));

  return {
    ownedCount: owned.length,
    wishlistCount: wishlist.length,
    wishlistTotal,
    ownedValue
  };
}

function getFilteredWatches(watches: Watch[], filters: CabinetFilters) {
  const query = filters.query.trim().toLowerCase();

  return [...watches]
    .filter((watch) => filters.tab === "all" || watch.status === filters.tab)
    .filter((watch) => {
      if (!query) return true;
      const haystack = [watch.brand, watch.model, watch.referenceNumber, watch.category, watch.status, watch.movement, formatCaseSize(watch.caseSize), getDomain(watch.sourceUrl)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => compareWatches(a, b, filters.sort, query));
}

function compareWatches(a: Watch, b: Watch, sort: CabinetFilters["sort"], query: string) {
  if (sort === "price-desc") {
    return (Number(b.price) || 0) - (Number(a.price) || 0) || compareByCustomOrder(a, b);
  }

  if (sort === "price-asc") {
    return (Number(a.price) || 0) - (Number(b.price) || 0) || compareByCustomOrder(a, b);
  }

  return getWatchRelevance(b, query) - getWatchRelevance(a, query) || compareByCustomOrder(a, b);
}

function sortWatchesByCustomOrder(watches: Watch[]) {
  return [...watches].sort(compareByCustomOrder);
}

function compareByCustomOrder(a: Watch, b: Watch) {
  const orderDifference = normalizeWatchDisplayOrder(a) - normalizeWatchDisplayOrder(b);
  return orderDifference || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

function normalizeWatchDisplayOrder(watch: Watch) {
  const order = Number(watch.displayOrder);
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function formatCaseSize(value: number) {
  const size = Number(value) || 0;
  if (!size) return "";
  return `${Number.isInteger(size) ? size : size.toFixed(1)} mm`;
}

function normalizeMovement(value: FormDataEntryValue | string | null | undefined) {
  const movement = String(value || "").trim();
  return movements.includes(movement as WatchMovement) ? (movement as WatchMovement) : "Automatic";
}

function getWatchRelevance(watch: Watch, query: string) {
  if (!query) return 0;

  const fields = [watch.brand, watch.model, watch.referenceNumber, watch.category, watch.status, watch.movement, formatCaseSize(watch.caseSize), getDomain(watch.sourceUrl)].map((value) =>
    value.toLowerCase()
  );
  return fields.reduce((score, value) => {
    if (value === query) return score + 8;
    if (value.startsWith(query)) return score + 4;
    if (value.includes(query)) return score + 1;
    return score;
  }, 0);
}

export default App;
