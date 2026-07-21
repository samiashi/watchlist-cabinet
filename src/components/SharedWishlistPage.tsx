import { useEffect, useMemo, useState } from "react";
import { Heart, Loader2, Watch } from "lucide-react";
import { loadSharedWishlist } from "../lib/cloudStorage";
import { formatCurrency, formatWatchCount, sum } from "../lib/formatters";
import { isSupabaseConfigured } from "../lib/supabase";
import type { Watch as WatchType } from "../lib/types";
import { WatchRow } from "./Board";
import { ImagePreview } from "./ImagePreview";

type PreviewState = { watch: WatchType; imageIndex: number };

export function SharedWishlistPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const [watches, setWatches] = useState<WatchType[]>([]);
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

  const filters = { tab: "all" as const, sort: "relevance" as const, query: "" };

  return (
    <div className="app-shell">
      <main className="workspace shared-workspace">
        <header className="shared-header">
          <div className="shared-brand">
            <div className="brand-mark" aria-hidden="true">
              <Watch size={20} />
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
                <Watch size={44} />
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
