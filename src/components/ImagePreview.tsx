import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LinkIcon, Pencil, Trash2, X } from "lucide-react";
import { getDomain, normalizeUrl } from "../lib/formatters";
import { getWatchImages, makeWatchImage } from "../lib/watchImages";
import type { Watch } from "../lib/types";

export function ImagePreview({
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
  const [imageLoaded, setImageLoaded] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const imageUrl = images[selectedImageIndex] || images[0] || makeWatchImage(watch.category, watch.id);
  const sourceDomain = getDomain(watch.sourceUrl);
  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    setSelectedImageIndex(clampImageIndex(initialImageIndex, images.length));
    setImageLoaded(false);
  }, [images.length, initialImageIndex, watch.id]);

  function handleImageLoad() {
    setImageLoaded(true);
  }

  function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
    event.currentTarget.src = makeWatchImage(watch.category, watch.id);
    handleImageLoad();
  }

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
            className={`image-preview-frame ${imageLoaded ? "" : "is-loading"}`}
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
              key={imageUrl}
              className={imageLoaded ? "is-visible" : ""}
              src={imageUrl}
              alt={`${watch.brand} ${watch.model}`}
              onLoad={handleImageLoad}
              onError={handleImageError}
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

export function clampImageIndex(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(Number(value) || 0, 0), total - 1);
}

export function getWrappedImageIndex(current: number, total: number, step: number) {
  if (total <= 1) return 0;
  return (clampImageIndex(current, total) + step + total) % total;
}
