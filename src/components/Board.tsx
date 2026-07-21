import { useEffect, useMemo, useState } from "react";
import { DragDropProvider, DragOverlay, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { ArrowDownUp, BadgeCheck, Banknote, Check, Clock, GripVertical, Grid3X3, Heart, Plus, Watch as WatchIcon, RotateCw, Ruler } from "lucide-react";
import { formatCurrency, formatWatchCount, getDomain } from "../lib/formatters";
import { getWatchImages, makeWatchImage } from "../lib/watchImages";
import { formatCaseSize } from "../hooks/watchHelpers";
import type { CabinetFilters, Watch, WatchCategory, WatchStatus } from "../lib/types";
import { reorderItems } from "../lib/reorderItems";
import { CategoryGlyph } from "./CategoryGlyph";

export function Board({
  watches,
  filters,
  canReorder,
  onFilterChange,
  onPreview,
  onReorder,
  onAdd
}: {
  watches: Watch[];
  filters: CabinetFilters;
  canReorder: boolean;
  onFilterChange: (filters: Partial<CabinetFilters>) => void;
  onPreview: (watch: Watch, imageIndex?: number) => void;
  onReorder: (orderedIds: string[]) => void;
  onAdd?: () => void;
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
              <SortableWatchRow watch={watch} index={index} key={watch.id} draggingId={draggingId} onPreview={onPreview} canReorder={canReorder} />
            ))}
          </div>
        ) : (
          <EmptyState onAdd={onAdd} />
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
  draggingId,
  onPreview,
  canReorder
}: {
  watch: Watch;
  index: number;
  draggingId: string | null;
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

  const isDragPlaceholder = isDragSource && draggingId === watch.id;

  return (
    <WatchRow
      watch={watch}
      index={index}
      onPreview={onPreview}
      canReorder={canReorder}
      isDragPlaceholder={isDragPlaceholder}
      rowRef={ref}
      handleRef={handleRef}
    />
  );
}

export function WatchRow({
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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const fallbackSrc = makeWatchImage(watch.category, index);

  useEffect(() => {
    setHasAnimated(true);
  }, []);

  function handleImageLoad() {
    setImageLoaded(true);
  }

  function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
    event.currentTarget.src = fallbackSrc;
    handleImageLoad();
  }

  return (
    <article
      ref={rowRef}
      className={`watch-row is-${watch.status} ${!hasAnimated ? "is-mounting" : ""} ${isDragPlaceholder ? "is-drag-placeholder" : ""} ${
        isDragOverlay ? "is-drag-overlay-card" : ""
      }`}
      data-watch-id={watch.id}
      style={{ "--card-index": index } as React.CSSProperties}
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
          <div className={`shelf-visual ${imageLoaded ? "" : "is-loading"}`}>
            <div className="row-thumb">
              <button
                className="row-thumb-open"
                type="button"
                onClick={() => onPreview(watch, 0)}
                aria-label={`View larger image of ${watch.brand} ${watch.model}`}
              >
                <img
                  className={`watch-image ${imageLoaded ? "is-visible" : ""}`}
                  src={primaryImage}
                  alt={`${watch.brand} ${watch.model}`}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
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

function EmptyState({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="empty-state">
      <div>
        <WatchIcon size={44} />
        <h2>No watches match this view</h2>
        <p>Add a watch or loosen the filters to rebuild the cabinet view.</p>
        {onAdd ? (
          <button className="button button-primary empty-state-button" type="button" onClick={onAdd}>
            <Plus size={16} />
            <span>Add watch</span>
          </button>
        ) : null}
      </div>
    </div>
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
        <option value="newest">Newest first</option>
        <option value="price-desc">Price high to low</option>
        <option value="price-asc">Price low to high</option>
      </select>
    </label>
  );
}
