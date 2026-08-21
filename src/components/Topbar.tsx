import { BadgeCheck, Plus, Search, ShoppingBag, X } from "lucide-react";
import { formatCurrency, formatWatchCount } from "../lib/formatters";
import type { CabinetFilters, CabinetSummary } from "../lib/types";
import { ShareMenu } from "./ShareMenu";

export function Topbar({
  filters,
  canShare,
  isSharing,
  onAdd,
  onCopyShareLink,
  onRotateShareLink,
  onDisableShareLink,
  onQueryChange,
  summary
}: {
  filters: CabinetFilters;
  canShare: boolean;
  isSharing: boolean;
  onAdd: () => void;
  onCopyShareLink: () => Promise<void>;
  onRotateShareLink: () => Promise<void>;
  onDisableShareLink: () => Promise<void>;
  onQueryChange: (query: string) => void;
  summary: CabinetSummary;
}) {
  const shareMenuProps = { isWorking: isSharing, onCopy: onCopyShareLink, onRotate: onRotateShareLink, onDisable: onDisableShareLink };

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
          {canShare ? <ShareMenu variant="icon" {...shareMenuProps} /> : null}
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
        {canShare ? <ShareMenu variant="full" {...shareMenuProps} /> : null}
        <button className="button button-primary topbar-desktop-action" type="button" onClick={onAdd}>
          <Plus size={18} />
          <span>Add watch</span>
        </button>
      </div>
    </header>
  );
}
