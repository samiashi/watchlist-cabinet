import { BadgeCheck, Loader2, Plus, Search, Share2, ShoppingBag, X } from "lucide-react";
import { formatCurrency, formatWatchCount } from "../lib/formatters";
import type { CabinetFilters, CabinetSummary } from "../lib/types";

export function Topbar({
  filters,
  canShare,
  isSharing,
  onAdd,
  onShare,
  onQueryChange,
  summary
}: {
  filters: CabinetFilters;
  canShare: boolean;
  isSharing: boolean;
  onAdd: () => void;
  onShare: () => void;
  onQueryChange: (query: string) => void;
  summary: CabinetSummary;
}) {
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <div>
          <h1 className="page-title">Cabinet</h1>
          <div className="desktop-summary">
            <span>
              <ShoppingBag size={12} />
              Wishlist: <strong>{formatCurrency(summary.wishlistTotal)}</strong>
              <small>({formatWatchCount(summary.wishlistCount)})</small>
            </span>
            <span>
              <BadgeCheck size={12} />
              Owned: <strong>{formatCurrency(summary.ownedValue)}</strong>
              <small>({formatWatchCount(summary.ownedCount)})</small>
            </span>
          </div>
        </div>
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
          {filters.query ? (
            <button className="search-clear" type="button" onClick={() => onQueryChange("")} aria-label="Clear search">
              <X size={16} />
            </button>
          ) : null}
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
