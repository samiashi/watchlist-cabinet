import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  Archive,
  BadgeCheck,
  Banknote,
  Calculator,
  Check,
  Clock,
  Cloud,
  Gem,
  Grid3X3,
  Heart,
  Link as LinkIcon,
  Loader2,
  LogOut,
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
import { deleteCloudWatch, loadCloudSnapshot, saveCloudBudget, upsertCloudWatch } from "./lib/cloudStorage";
import { cleanText, createId, formatCurrency, formatWatchCount, getDomain, normalizeUrl, sum } from "./lib/formatters";
import { loadLocalSnapshot, saveLocalSnapshot } from "./lib/localStorage";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { categories, type CabinetFilters, type CabinetSummary, type CategorySummary, type Watch, type WatchCategory, type WatchStatus } from "./lib/types";
import { makeWatchImage } from "./lib/watchImages";

const emptyFilters: CabinetFilters = { tab: "all", category: "all", query: "" };

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
      setAuthMessage("");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
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

  async function signInWithEmail(email: string) {
    if (!supabase) return;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setAuthMessage("Check your email for the sign-in link.");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setWatches([]);
    setFilters(emptyFilters);
    setBudget(22000);
    setDrawer({ open: false, editingId: null });
  }

  function updateFilters(nextFilters: Partial<CabinetFilters>) {
    setFilters((current) => ({ ...current, ...nextFilters }));
  }

  function updateBudget(nextBudget: number) {
    setBudget(nextBudget);
    if (cloudUser) {
      saveCloudBudget(cloudUser, nextBudget).catch((error: Error) => showToast(`Budget was not saved: ${error.message}`));
    }
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

  async function toggleStatus(id: string) {
    const watch = watches.find((item) => item.id === id);
    if (!watch) return;

    const nextWatch: Watch = {
      ...watch,
      status: watch.status === "owned" ? "wishlist" : "owned",
      updatedAt: new Date().toISOString()
    };

    try {
      await saveWatch(nextWatch);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Status was not saved.");
    }
  }

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  if (isSupabaseConfigured && !session) {
    return <AuthGate message={authMessage} onSignIn={signInWithEmail} />;
  }

  return (
    <div className="app-shell">
      <main className="workspace">
        <MobileHeader onAdd={() => openDrawer()} onSignOut={cloudUser ? signOut : undefined} />
        <Topbar
          filters={filters}
          user={cloudUser}
          onAdd={() => openDrawer()}
          onQueryChange={(query) => updateFilters({ query })}
          onSignOut={signOut}
        />
        <MobileSummary summary={summary} />
        <Controls filters={filters} onChange={updateFilters} />
        <div className="content-grid">
          <Board
            watches={filteredWatches}
            tab={filters.tab}
            onEdit={openDrawer}
            onDelete={deleteWatch}
            onToggleStatus={toggleStatus}
          />
          <CalculatorPanel summary={summary} budget={budget} onBudgetChange={updateBudget} isCloud={Boolean(cloudUser)} />
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

function AuthGate({ message, onSignIn }: { message: string; onSignIn: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    await onSignIn(email);
    setIsSubmitting(false);
  }

  return (
    <main className="auth-shell" aria-label="Sign in">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand-mark" aria-hidden="true">
          <WatchIcon size={21} />
        </div>
        <div>
          <h1>Cabinet</h1>
          <p>Sign in once to sync the watch list on your phone.</p>
        </div>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        <button className="button button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="spin" size={16} /> : <Cloud size={16} />}
          <span>Send sign-in link</span>
        </button>
        {message ? <p className="auth-message">{message}</p> : null}
      </form>
    </main>
  );
}

function MobileHeader({ onAdd, onSignOut }: { onAdd: () => void; onSignOut?: () => void }) {
  return (
    <header className="mobile-appbar" aria-label="Mobile app header">
      <div className="mobile-brand">
        <div className="brand-mark" aria-hidden="true">
          <WatchIcon size={19} />
        </div>
        <div>
          <p className="mobile-brand-title">Cabinet</p>
          <p className="mobile-brand-note">Shelf view</p>
        </div>
      </div>
      <div className="mobile-header-actions">
        {onSignOut ? (
          <button className="button button-icon" type="button" onClick={onSignOut} aria-label="Sign out">
            <LogOut size={16} />
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
  user,
  onAdd,
  onQueryChange,
  onSignOut
}: {
  filters: CabinetFilters;
  user: User | null;
  onAdd: () => void;
  onQueryChange: (query: string) => void;
  onSignOut: () => void;
}) {
  return (
    <header className="topbar">
      <div>
        <h2 className="page-title">Shelf</h2>
        <p className="page-note">Display the collection, check the category gaps, and price the next watch in AED.</p>
      </div>
      <div className="topbar-controls">
        <label className="search-box">
          <span className="sr-only">Search watches</span>
          <Search size={18} aria-hidden="true" />
          <input
            id="searchInput"
            type="search"
            value={filters.query}
            placeholder="Search watches"
            autoComplete="off"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <button className="button button-primary" type="button" onClick={onAdd}>
          <Plus size={18} />
          <span>Add watch</span>
        </button>
        {user ? (
          <button className="button button-icon desktop-signout" type="button" onClick={onSignOut} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        ) : null}
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
          All categories
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
  onDelete,
  onToggleStatus
}: {
  watches: Watch[];
  tab: CabinetFilters["tab"];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
}) {
  const title = tab === "wishlist" ? "Wishlist shelf" : tab === "owned" ? "Owned shelf" : "Shelf";

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
        <div className="watch-table" role="table" aria-label="Watches">
          <div className="watch-table-head" role="row">
            <span>Watch</span>
            <span>Status</span>
            <span>Price</span>
            <span>Actions</span>
          </div>
          <div className="watch-table-body">
            {watches.map((watch, index) => (
              <WatchRow
                watch={watch}
                index={index}
                key={watch.id}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleStatus={onToggleStatus}
              />
            ))}
          </div>
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
  onDelete,
  onToggleStatus
}: {
  watch: Watch;
  index: number;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
}) {
  const statusLabel = watch.status === "owned" ? "Owned" : "Wishlist";
  const nextStatusLabel = watch.status === "owned" ? "Move to wishlist" : "Mark owned";
  const sourceDomain = getDomain(watch.sourceUrl);

  return (
    <article className={`watch-row is-${watch.status}`} role="row">
      <div className="shelf-visual" role="cell">
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
        <div className={`status-badge is-${watch.status}`}>
          {watch.status === "owned" ? <Check size={13} /> : <Clock size={13} />}
          {statusLabel}
        </div>
      </div>
      <div className="watch-copy" role="cell">
        <div className="watch-topline">
          <div>
            <div className="watch-kicker">{watch.brand}</div>
            <h3 className="watch-name">{watch.model}</h3>
          </div>
          <div className="price" role="cell">
            <Banknote size={16} />
            {formatCurrency(watch.price)}
          </div>
        </div>
        <div className="row-meta">
          <span className="category-label">
            <CategoryGlyph category={watch.category} size={13} />
            {watch.category}
          </span>
          <a className="source-link" href={normalizeUrl(watch.sourceUrl)} target="_blank" rel="noreferrer">
            <LinkIcon size={13} />
            <span>{sourceDomain}</span>
          </a>
        </div>
        <p className="watch-notes">{watch.notes || "No notes yet."}</p>
        <div className="watch-actions" role="cell">
          <button className="button" type="button" onClick={() => onToggleStatus(watch.id)} title={nextStatusLabel}>
            {watch.status === "owned" ? <Heart size={15} /> : <Check size={15} />}
            <span>{watch.status === "owned" ? "Wishlist" : "Owned"}</span>
          </button>
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

function CalculatorPanel({
  summary,
  budget,
  onBudgetChange,
  isCloud
}: {
  summary: CabinetSummary;
  budget: number;
  onBudgetChange: (budget: number) => void;
  isCloud: boolean;
}) {
  const needed = summary.categoryStats
    .filter((item) => item.owned < item.target)
    .sort((a, b) => b.target - b.owned - (a.target - a.owned) || b.wishlistCount - a.wishlistCount);

  return (
    <aside className="calculator" aria-label="Wishlist price calculator">
      <div className="calculator-header">
        <div>
          <h2 className="section-title">Costs</h2>
          <p className="section-meta">AED budget and gaps</p>
        </div>
        {isCloud ? <Cloud size={22} /> : <Calculator size={22} />}
      </div>
      <div className="calculator-body">
        <div className="total-panel">
          <div className="total-label">
            <ShoppingBag size={14} />
            Wishlist total
          </div>
          <div className="total-value">{formatCurrency(summary.wishlistTotal)}</div>
          <p className="total-caption">{formatWatchCount(summary.wishlistCount)} on the wishlist</p>
        </div>
        <label className="budget-control">
          <span>
            <WalletCards size={14} />
            Budget
          </span>
          <input
            id="budgetInput"
            type="number"
            min="0"
            step="100"
            value={budget}
            inputMode="decimal"
            onChange={(event) => onBudgetChange(Number(event.target.value) || 0)}
          />
        </label>
        <div className="delta">
          {summary.budgetDelta >= 0 ? (
            <>
              <strong>{formatCurrency(summary.budgetDelta)}</strong> left if you bought the wishlist.
            </>
          ) : (
            <>
              <strong>{formatCurrency(Math.abs(summary.budgetDelta))}</strong> above the current budget.
            </>
          )}
        </div>
        <div>
          <h3 className="section-title">Gaps</h3>
          <div className="needs-list">
            {needed.length ? (
              needed.map((item) => (
                <div className="need-item" key={item.name}>
                  <div className="need-title">
                    <span>
                      <CategoryGlyph category={item.name} size={14} />
                      {item.name}
                    </span>
                    <span>
                      {item.owned}/{item.target}
                    </span>
                  </div>
                  <div className="need-text">{renderNeedText(item)}</div>
                </div>
              ))
            ) : (
              <div className="need-item">
                <div className="need-title">
                  <span>Balanced</span>
                  <span>
                    {categories.length}/{categories.length}
                  </span>
                </div>
                <div className="need-text">Every target category has at least one owned watch.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
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
            <label htmlFor="sourceUrl">Watch page URL</label>
            <input id="sourceUrl" name="sourceUrl" type="url" defaultValue={watch.sourceUrl} placeholder="https://shop.example.com/watch-page" required />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="brand">Brand</label>
              <input id="brand" name="brand" defaultValue={watch.brand} placeholder="Omega" required />
            </div>
            <div className="field">
              <label htmlFor="model">Model</label>
              <input id="model" name="model" defaultValue={watch.model} placeholder="Speedmaster" required />
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" name="category" defaultValue={watch.category}>
                {categories.map((category) => (
                  <option value={category.name} key={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={watch.status}>
                <option value="wishlist">Wishlist</option>
                <option value="owned">Owned</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="price">Price (AED)</label>
              <input id="price" name="price" type="number" min="0" step="1" defaultValue={String(watch.price ?? "")} placeholder="9200" inputMode="decimal" required />
            </div>
            <div className="field is-wide">
              <label htmlFor="imageUrl">Photo URL</label>
              <input
                id="imageUrl"
                name="imageUrl"
                type="url"
                defaultValue={watch.imageUrl && !watch.imageUrl.startsWith("data:") ? watch.imageUrl : ""}
                placeholder="https://image.example.com/watch.jpg"
              />
            </div>
            <div className="field is-wide">
              <label htmlFor="notes">Notes</label>
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

  const categoryStats = categories.map((category) => {
    const categoryOwned = owned.filter((watch) => watch.category === category.name);
    const categoryWishlist = wishlist.filter((watch) => watch.category === category.name);
    const wishlistPrices = categoryWishlist.map((watch) => Number(watch.price) || 0).filter(Boolean);

    return {
      name: category.name,
      target: category.target,
      owned: categoryOwned.length,
      wishlistCount: categoryWishlist.length,
      wishlistTotal: sum(categoryWishlist.map((watch) => Number(watch.price) || 0)),
      lowestWishlist: wishlistPrices.length ? Math.min(...wishlistPrices) : 0
    };
  });

  return {
    ownedCount: owned.length,
    wishlistCount: wishlist.length,
    wishlistTotal,
    ownedValue,
    budgetDelta: budget - wishlistTotal,
    categoryStats
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

function renderNeedText(item: CategorySummary) {
  if (item.wishlistCount) {
    return `${formatWatchCount(item.wishlistCount)} on the wishlist - lowest ${formatCurrency(item.lowestWishlist || 0)}`;
  }

  return `No wishlist candidate yet - add a ${item.name.toLowerCase()} watch.`;
}

export default App;
