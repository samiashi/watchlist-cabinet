import { BadgeCheck, ShoppingBag } from "lucide-react";
import { formatCurrency, formatWatchCount } from "../lib/formatters";
import type { CabinetSummary } from "../lib/types";

export function MobileSummary({ summary }: { summary: CabinetSummary }) {
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
