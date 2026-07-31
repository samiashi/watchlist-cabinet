import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  BadgeCheck, Banknote, Grid3X3, Hash, Heart, Images, LinkIcon, Loader2, RotateCw, Ruler, Save, Trash2, Upload, Watch as WatchIcon, ChevronDown, ChevronUp, X
} from "lucide-react";
import { categories, maxWatchImages, movements, type Watch, type CabinetFilters, type WatchCategory, type WatchMovement } from "../lib/types";
import { pendingImageFiles, getStoredImageItems, normalizeMovement, clearPendingImageFiles } from "../hooks/watchHelpers";
import type { ManagedImage } from "../hooks/watchHelpers";
import { useFocusTrap } from "../hooks/useFocusTrap";

export function WatchDrawer({
  editing,
  filters,
  isSubmitting,
  canUploadImages,
  onClose,
  onSubmit
}: {
  editing: Watch | null;
  filters: CabinetFilters;
  isSubmitting: boolean;
  canUploadImages: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const drawerRef = useFocusTrap(true);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    clearPendingImageFiles();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isSubmitting, onClose]);

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
      ref={drawerRef}
      className="drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="watchDrawerTitle"
      onClick={(event) => {
        if (isSubmitting) return;
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchStart={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest(".drawer-body")) {
          touchStartY.current = null;
          return;
        }
        touchStartY.current = event.changedTouches[0]?.clientY ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStartY.current === null || isSubmitting) return;
        const delta = touchStartY.current - (event.changedTouches[0]?.clientY ?? touchStartY.current);
        touchStartY.current = null;
        if (Math.abs(delta) < 80) return;
        onClose();
      }}
    >
      <form className="drawer" id="watchForm" aria-label={editing ? "Edit watch" : "Add watch"} onSubmit={onSubmit}>
        <div className="drawer-header">
          <h2 className="drawer-title" id="watchDrawerTitle">{editing ? "Edit watch" : "Add watch"}</h2>
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
            <input
              id="sourceUrl"
              name="sourceUrl"
              type="text"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={watch.sourceUrl}
              placeholder="shop.example.com/watch-page"
              required
            />
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
                max="999.9"
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
              <input id="price" name="price" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={String(watch.price ?? "")} placeholder="9200" inputMode="decimal" required />
            </div>
            <div className="field is-wide">
              <label>
                <Images size={15} />
                Images
              </label>
              <ImageManager initialImages={initialImages} canUploadImages={canUploadImages} />
              <p className="field-help">
                {canUploadImages ? "Uploaded files stay private and are shown through short-lived signed URLs." : "Sign in with Google to upload private watch images."}
              </p>
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

function ImageManager({ initialImages, canUploadImages }: { initialImages: ManagedImage[]; canUploadImages: boolean }) {
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

      <label className={`upload-target ${remainingSlots <= 0 || !canUploadImages ? "is-disabled" : ""}`} htmlFor="imageFiles">
        <Upload size={16} />
        <span>{!canUploadImages ? "Sign in to upload images" : remainingSlots > 0 ? `Upload images (${remainingSlots} left)` : "Image limit reached"}</span>
      </label>
      <input
        ref={fileInputRef}
        className="image-file-input"
        id="imageFiles"
        name="imageFiles"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        multiple
        disabled={remainingSlots <= 0 || !canUploadImages}
        onChange={(event) => {
          addFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
