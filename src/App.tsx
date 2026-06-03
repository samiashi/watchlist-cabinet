import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowDownUp,
  BadgeCheck,
  Banknote,
  Check,
  Clock,
  Gem,
  Grid3X3,
  Heart,
  Image as ImageIcon,
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
  Watch as WatchIcon,
  Waves,
  X
} from "lucide-react";
import { deleteCloudWatch, getOrCreateShareLink, loadCloudSnapshot, loadSharedWishlist, upsertCloudWatch } from "./lib/cloudStorage";
import { cleanText, createId, formatCurrency, formatWatchCount, getDomain, normalizeUrl, sum } from "./lib/formatters";
import { loadLocalSnapshot, saveLocalSnapshot } from "./lib/localStorage";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { categories, type CabinetFilters, type CabinetSummary, type Watch, type WatchCategory, type WatchStatus } from "./lib/types";
import { makeWatchImage } from "./lib/watchImages";

const emptyFilters: CabinetFilters = { tab: "all", query: "", sort: "relevance" };
const siteUrl = import.meta.env.VITE_SITE_URL?.trim();

type DrawerState = { open: false; editingId: null } | { open: true; editingId: string | null };

function App() {
  const shareToken = getShareTokenFromPath();
  return shareToken ? <SharedWishlistPage token={shareToken} /> : <CabinetApp />;
}

function CabinetApp() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [filters, setFilters] = useState<CabinetFilters>(emptyFilters);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, editingId: null });
  const [previewWatch, setPreviewWatch] = useState<Watch | null>(null);
  const [toast, setToast] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const toastTimer = useRef<number | null>(null);
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

  async function handleWatchFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editingId = drawer.editingId;
    const existing = editingId ? watches.find((watch) => watch.id === editingId) : null;
    const category = String(form.get("category")) as WatchCategory;
    const imageUrl = String(form.get("imageUrl") || "").trim();

    const watch: Watch = {
      id: existing?.id || createId(),
      brand: cleanText(form.get("brand")),
      model: cleanText(form.get("model")),
      category,
      status: String(form.get("status")) as WatchStatus,
      movement: normalizeMovement(form.get("movement")),
      caseSize: Number(form.get("caseSize")) || 0,
      price: Number(form.get("price")) || 0,
      sourceUrl: normalizeUrl(form.get("sourceUrl")),
      imageUrl: imageUrl || existing?.imageUrl || makeWatchImage(category, watches.length + 1),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!watch.brand || !watch.model || !watch.sourceUrl) {
      showToast("Brand, model, and URL are required.");
      return;
    }

    try {
      await saveWatch(watch);
      closeDrawer();
      showToast(existing ? "Watch updated." : "Watch added.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Watch was not saved.");
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
      if (cloudUser) await deleteCloudWatch(id);
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
        <MobileHeader canShare={Boolean(cloudUser)} isSharing={isSharing} onAdd={() => openDrawer()} onShare={shareWishlist} />
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
            onFilterChange={updateFilters}
            onPreview={setPreviewWatch}
          />
        </div>
      </main>
      {drawer.open ? (
        <WatchDrawer
          editing={drawer.editingId ? watches.find((watch) => watch.id === drawer.editingId) || null : null}
          filters={filters}
          onClose={closeDrawer}
          onSubmit={handleWatchFormSubmit}
        />
      ) : null}
      {previewWatch ? (
        <ImagePreview
          watch={previewWatch}
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
  const [previewWatch, setPreviewWatch] = useState<Watch | null>(null);
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
                <WatchRow watch={watch} index={index} key={watch.id} onPreview={setPreviewWatch} />
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
          watch={previewWatch}
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

function MobileHeader({
  canShare,
  isSharing,
  onAdd,
  onShare
}: {
  canShare: boolean;
  isSharing: boolean;
  onAdd: () => void;
  onShare: () => void;
}) {
  return (
    <header className="mobile-appbar" aria-label="Mobile app header">
      <div className="mobile-brand">
        <div className="brand-mark" aria-hidden="true">
          <WatchIcon size={19} />
        </div>
        <p className="mobile-brand-title">Cabinet</p>
      </div>
      <div className="mobile-header-actions">
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
    </header>
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
      <h1 className="page-title">Cabinet</h1>
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
          <button className="button" type="button" onClick={onShare} disabled={isSharing}>
            {isSharing ? <Loader2 className="spin" size={17} /> : <Share2 size={17} />}
            <span>Share</span>
          </button>
        ) : null}
        <button className="button button-primary" type="button" onClick={onAdd}>
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
        <option value="relevance">Relevance</option>
        <option value="price-desc">Price high to low</option>
        <option value="price-asc">Price low to high</option>
      </select>
    </label>
  );
}

function Board({
  watches,
  filters,
  onFilterChange,
  onPreview
}: {
  watches: Watch[];
  filters: CabinetFilters;
  onFilterChange: (filters: Partial<CabinetFilters>) => void;
  onPreview: (watch: Watch) => void;
}) {
  return (
    <section className="board" aria-label="Watch collection">
      <div className="board-header">
        <div>
          <h2 className="section-title">Collection</h2>
          <p className="section-meta">{formatWatchCount(watches.length)} saved</p>
        </div>
        <div className="collection-controls">
          <StatusTabs tab={filters.tab} onChange={(tab) => onFilterChange({ tab })} />
          <SortSelect sort={filters.sort} onChange={(sort) => onFilterChange({ sort })} />
        </div>
      </div>
      {watches.length ? (
        <div className="watch-grid" aria-label="Watches">
          {watches.map((watch, index) => (
            <WatchRow
              watch={watch}
              index={index}
              key={watch.id}
              onPreview={onPreview}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </section>
  );
}

function WatchRow({
  watch,
  index,
  onPreview
}: {
  watch: Watch;
  index: number;
  onPreview: (watch: Watch) => void;
}) {
  const statusLabel = watch.status === "owned" ? "Owned" : "Wishlist";

  return (
    <article className={`watch-row is-${watch.status}`}>
      <div className="shelf-visual">
        <button
          className="row-thumb"
          type="button"
          onClick={() => onPreview(watch)}
          aria-label={`View larger image of ${watch.brand} ${watch.model}`}
        >
          <img
            className="watch-image"
            src={watch.imageUrl || makeWatchImage(watch.category, watch.id)}
            alt={`${watch.brand} ${watch.model}`}
            onError={(event) => {
              event.currentTarget.src = makeWatchImage(watch.category, index);
            }}
          />
        </button>
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
  onClose,
  onEdit,
  onDelete
}: {
  watch: Watch;
  onClose: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
}) {
  const imageUrl = watch.imageUrl || makeWatchImage(watch.category, watch.id);
  const sourceDomain = getDomain(watch.sourceUrl);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

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
            <a className="preview-source-link" href={normalizeUrl(watch.sourceUrl)} target="_blank" rel="noreferrer">
              <LinkIcon size={13} />
              <span>{sourceDomain}</span>
            </a>
          </div>
          <div className="image-preview-actions">
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
        <div className="image-preview-frame">
          <img src={imageUrl} alt={`${watch.brand} ${watch.model}`} />
        </div>
      </div>
    </div>
  );
}

function WatchDrawer({
  editing,
  filters,
  onClose,
  onSubmit
}: {
  editing: Watch | null;
  filters: CabinetFilters;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const watch = editing || {
    brand: "",
    model: "",
    category: "Dress",
    status: filters.tab === "owned" ? "owned" : "wishlist",
    movement: "Automatic",
    caseSize: "",
    price: "",
    sourceUrl: "",
    imageUrl: ""
  };

  return (
    <div
      className="drawer-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="drawer" id="watchForm" aria-label={editing ? "Edit watch" : "Add watch"} onSubmit={onSubmit}>
        <div className="drawer-header">
          <h2 className="drawer-title">{editing ? "Edit watch" : "Add watch"}</h2>
          <button className="button button-icon" type="button" onClick={onClose} aria-label="Close drawer">
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
                <option value="Automatic">Automatic</option>
                <option value="Quartz">Quartz</option>
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
              <label htmlFor="imageUrl">
                <ImageIcon size={15} />
                Photo URL
              </label>
              <input
                id="imageUrl"
                name="imageUrl"
                type="url"
                defaultValue={watch.imageUrl && !watch.imageUrl.startsWith("data:") ? watch.imageUrl : ""}
                placeholder="https://image.example.com/watch.jpg"
              />
            </div>
          </div>
        </div>
        <div className="drawer-footer">
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" type="submit">
            <Save size={16} />
            <span>{editing ? "Save changes" : "Add watch"}</span>
          </button>
        </div>
      </form>
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
              ? Plane
              : Sun;

  return <Icon size={size} aria-hidden="true" />;
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
      const haystack = [watch.brand, watch.model, watch.category, watch.status, watch.movement, formatCaseSize(watch.caseSize), getDomain(watch.sourceUrl)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => compareWatches(a, b, filters.sort, query));
}

function compareWatches(a: Watch, b: Watch, sort: CabinetFilters["sort"], query: string) {
  if (sort === "price-desc") {
    return (Number(b.price) || 0) - (Number(a.price) || 0) || compareByRecency(a, b);
  }

  if (sort === "price-asc") {
    return (Number(a.price) || 0) - (Number(b.price) || 0) || compareByRecency(a, b);
  }

  return getWatchRelevance(b, query) - getWatchRelevance(a, query) || compareByRecency(a, b);
}

function compareByRecency(a: Watch, b: Watch) {
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

function formatCaseSize(value: number) {
  const size = Number(value) || 0;
  if (!size) return "";
  return `${Number.isInteger(size) ? size : size.toFixed(1)} mm`;
}

function normalizeMovement(value: FormDataEntryValue | string | null | undefined) {
  return String(value) === "Quartz" ? "Quartz" : "Automatic";
}

function getWatchRelevance(watch: Watch, query: string) {
  if (!query) return 0;

  const fields = [watch.brand, watch.model, watch.category, watch.status, watch.movement, formatCaseSize(watch.caseSize), getDomain(watch.sourceUrl)].map((value) =>
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
