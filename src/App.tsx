import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Archive,
  BadgeCheck,
  Banknote,
  Check,
  Clock,
  FileText,
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
  Save,
  Search,
  ShelvingUnit,
  ShoppingBag,
  Sun,
  Timer,
  Trash2,
  WalletCards,
  Watch as WatchIcon,
  Waves,
  X
} from "lucide-react";
import { deleteCloudWatch, loadCloudSnapshot, upsertCloudWatch } from "./lib/cloudStorage";
import { cleanText, createId, formatCurrency, formatWatchCount, getDomain, normalizeUrl, sum } from "./lib/formatters";
import { loadLocalSnapshot, saveLocalSnapshot } from "./lib/localStorage";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { categories, type CabinetFilters, type CabinetSummary, type Watch, type WatchCategory, type WatchStatus } from "./lib/types";
import { makeWatchImage } from "./lib/watchImages";

const emptyFilters: CabinetFilters = { tab: "all", category: "all", query: "" };
const siteUrl = import.meta.env.VITE_SITE_URL?.trim();

type DrawerState = { open: false; editingId: null } | { open: true; editingId: string | null };

function App() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [filters, setFilters] = useState<CabinetFilters>(emptyFilters);
  const [budget, setBudget] = useState(22000);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, editingId: null });
  const [toast, setToast] = useState("");
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
      setBudget(snapshot.budget);
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
    saveLocalSnapshot({ watches, filters, budget });
  }, [budget, filters, isLoaded, watches]);

  useEffect(() => {
    if (!isLoaded || !cloudUser) return;

    let active = true;
    setAuthMessage("");

    loadCloudSnapshot(cloudUser)
      .then((snapshot) => {
        if (!active) return;
        setWatches(snapshot.watches);
        setFilters(snapshot.filters);
        setBudget(snapshot.budget);
      })
      .catch((error: Error) => {
        if (!active) return;
        showToast(`Could not load Supabase data: ${error.message}`);
      });

    return () => {
      active = false;
    };
  }, [cloudUser, isLoaded]);

  const summary = useMemo(() => getSummary(watches, budget), [budget, watches]);
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
      price: Number(form.get("price")) || 0,
      sourceUrl: normalizeUrl(form.get("sourceUrl")),
      imageUrl: imageUrl || existing?.imageUrl || makeWatchImage(category, watches.length + 1),
      notes: cleanText(form.get("notes")),
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
    if (!watch) return;
    const confirmed = window.confirm(`Delete ${watch.brand} ${watch.model}?`);
    if (!confirmed) return;

    const previous = watches;
    setWatches((current) => current.filter((item) => item.id !== id));

    try {
      if (cloudUser) await deleteCloudWatch(id);
      showToast("Watch deleted.");
    } catch (error) {
      setWatches(previous);
      showToast(error instanceof Error ? error.message : "Watch was not deleted.");
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
        <MobileHeader watchCount={watches.length} onAdd={() => openDrawer()} />
        <Topbar
          filters={filters}
          watchCount={watches.length}
          onAdd={() => openDrawer()}
          onQueryChange={(query) => updateFilters({ query })}
        />
        <MobileSummary summary={summary} />
        <Controls filters={filters} onChange={updateFilters} />
        <div className="content-grid">
          <Board
            watches={filteredWatches}
            tab={filters.tab}
            onEdit={openDrawer}
            onDelete={deleteWatch}
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
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
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
  return (siteUrl || window.location.origin).replace(/\/+$/, "");
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

function MobileHeader({ watchCount, onAdd }: { watchCount: number; onAdd: () => void }) {
  return (
    <header className="mobile-appbar" aria-label="Mobile app header">
      <div className="mobile-brand">
        <div className="brand-mark" aria-hidden="true">
          <WatchIcon size={19} />
        </div>
        <div>
          <p className="mobile-brand-title">Cabinet</p>
          <p className="mobile-brand-note">{formatWatchCount(watchCount)}</p>
        </div>
      </div>
      <div className="mobile-header-actions">
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
  watchCount,
  onAdd,
  onQueryChange
}: {
  filters: CabinetFilters;
  watchCount: number;
  onAdd: () => void;
  onQueryChange: (query: string) => void;
}) {
  return (
    <header className="topbar">
      <div>
        <h1 className="page-title">Cabinet</h1>
        <p className="page-note">{formatWatchCount(watchCount)} saved</p>
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
        <button className="button button-primary" type="button" onClick={onAdd}>
          <Plus size={18} />
          <span>Add watch</span>
        </button>
      </div>
    </header>
  );
}

function MobileSummary({ summary }: { summary: CabinetSummary }) {
  const budgetLabel =
    summary.budgetDelta >= 0
      ? `${formatCurrency(summary.budgetDelta)} left`
      : `${formatCurrency(Math.abs(summary.budgetDelta))} to go`;

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
      <div className="mobile-budget-row">
        <span>
          <WalletCards size={17} />
          Gap
        </span>
        <strong>{budgetLabel}</strong>
      </div>
    </section>
  );
}

function Controls({ filters, onChange }: { filters: CabinetFilters; onChange: (filters: Partial<CabinetFilters>) => void }) {
  const tabOptions = [
    { id: "all", label: "All", icon: Grid3X3 },
    { id: "owned", label: "Owned", icon: BadgeCheck },
    { id: "wishlist", label: "Wishlist", icon: Heart }
  ] as const;

  return (
    <section className="controls-band" aria-label="Collection filters">
      <div className="tabs" role="tablist" aria-label="Status">
        {tabOptions.map((tab) => (
          <button
            className={`tab ${filters.tab === tab.id ? "is-active" : ""}`}
            type="button"
            key={tab.id}
            onClick={() => onChange({ tab: tab.id })}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>
      <div className="chip-row" aria-label="Category filters">
        <button
          className={`chip ${filters.category === "all" ? "is-active" : ""}`}
          type="button"
          onClick={() => onChange({ category: "all" })}
        >
          <Archive size={15} />
          All
        </button>
        {categories.map((category) => (
          <button
            className={`chip ${filters.category === category.name ? "is-active" : ""}`}
            type="button"
            key={category.name}
            onClick={() => onChange({ category: category.name })}
          >
            <CategoryGlyph category={category.name} size={15} />
            {category.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function Board({
  watches,
  tab,
  onEdit,
  onDelete
}: {
  watches: Watch[];
  tab: CabinetFilters["tab"];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const title = tab === "wishlist" ? "Wishlist" : tab === "owned" ? "Owned" : "Collection";

  return (
    <section className="board" aria-label="Watch collection">
      <div className="board-header">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-meta">{formatWatchCount(watches.length)} saved</p>
        </div>
        <ShelvingUnit size={22} />
      </div>
      {watches.length ? (
        <div className="watch-grid" aria-label="Watches">
          {watches.map((watch, index) => (
            <WatchRow
              watch={watch}
              index={index}
              key={watch.id}
              onEdit={onEdit}
              onDelete={onDelete}
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
  onEdit,
  onDelete
}: {
  watch: Watch;
  index: number;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const statusLabel = watch.status === "owned" ? "Owned" : "Wishlist";
  const sourceDomain = getDomain(watch.sourceUrl);

  return (
    <article className={`watch-row is-${watch.status}`}>
      <div className="shelf-visual">
        <div className="row-thumb">
          <img
            className="watch-image"
            src={watch.imageUrl || makeWatchImage(watch.category, watch.id)}
            alt={`${watch.brand} ${watch.model}`}
            onError={(event) => {
              event.currentTarget.src = makeWatchImage(watch.category, index);
            }}
          />
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
          <a className="source-link" href={normalizeUrl(watch.sourceUrl)} target="_blank" rel="noreferrer">
            <LinkIcon size={13} />
            <span>{sourceDomain}</span>
          </a>
        </div>
        <p className="watch-notes">{watch.notes || "No notes yet."}</p>
        <div className="watch-actions">
          <div className="action-group">
            <button className="button button-icon" type="button" onClick={() => onEdit(watch.id)} title="Edit watch" aria-label="Edit watch">
              <Pencil size={16} />
            </button>
            <button
              className="button button-icon button-danger"
              type="button"
              onClick={() => onDelete(watch.id)}
              title="Delete watch"
              aria-label="Delete watch"
            >
              <Trash2 size={16} />
            </button>
          </div>
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
    category: filters.category === "all" ? "Dress" : filters.category,
    status: filters.tab === "owned" ? "owned" : "wishlist",
    price: "",
    sourceUrl: "",
    imageUrl: "",
    notes: ""
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
                  <option value={category.name} key={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="field status-field">
              <legend>
                <Heart size={15} />
                Status
              </legend>
              <div className="status-toggle">
                <label>
                  <input type="radio" name="status" value="wishlist" defaultChecked={watch.status === "wishlist"} />
                  <span>
                    <Heart size={14} />
                    Wishlist
                  </span>
                </label>
                <label>
                  <input type="radio" name="status" value="owned" defaultChecked={watch.status === "owned"} />
                  <span>
                    <Check size={14} />
                    Owned
                  </span>
                </label>
              </div>
            </fieldset>
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
            <div className="field is-wide">
              <label htmlFor="notes">
                <FileText size={15} />
                Notes
              </label>
              <textarea id="notes" name="notes" defaultValue={watch.notes || ""} placeholder="Why this watch belongs in the cabinet" />
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

function getSummary(watches: Watch[], budget: number): CabinetSummary {
  const owned = watches.filter((watch) => watch.status === "owned");
  const wishlist = watches.filter((watch) => watch.status === "wishlist");
  const wishlistTotal = sum(wishlist.map((watch) => Number(watch.price) || 0));
  const ownedValue = sum(owned.map((watch) => Number(watch.price) || 0));

  return {
    ownedCount: owned.length,
    wishlistCount: wishlist.length,
    wishlistTotal,
    ownedValue,
    budgetDelta: budget - wishlistTotal
  };
}

function getFilteredWatches(watches: Watch[], filters: CabinetFilters) {
  const query = filters.query.trim().toLowerCase();

  return [...watches]
    .filter((watch) => filters.tab === "all" || watch.status === filters.tab)
    .filter((watch) => filters.category === "all" || watch.category === filters.category)
    .filter((watch) => {
      if (!query) return true;
      const haystack = [watch.brand, watch.model, watch.category, watch.status, watch.notes, getDomain(watch.sourceUrl)].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export default App;
