import { useEffect, useRef, useState } from "react";
import { Copy, Link2Off, Loader2, RefreshCw, Share2 } from "lucide-react";

export function ShareMenu({
  variant,
  isWorking,
  onCopy,
  onRotate,
  onDisable
}: {
  variant: "icon" | "full";
  isWorking: boolean;
  onCopy: () => void | Promise<void>;
  onRotate: () => void | Promise<void>;
  onDisable: () => void | Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function runAction(action: () => void | Promise<void>) {
    setIsOpen(false);
    void action();
  }

  const triggerClass = variant === "icon" ? "button button-icon mobile-share-button" : "button topbar-desktop-action";

  return (
    <div className="share-menu" ref={containerRef}>
      <button
        className={triggerClass}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isWorking}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Wishlist link options"
      >
        {isWorking ? <Loader2 className="spin" size={17} /> : <Share2 size={17} />}
        {variant === "full" ? <span>Share</span> : null}
      </button>
      {isOpen ? (
        <div className="share-menu-popover" role="menu" aria-label="Wishlist link actions">
          <button role="menuitem" type="button" onClick={() => runAction(onCopy)}>
            <Copy size={15} />
            <span>Copy link</span>
          </button>
          <button role="menuitem" type="button" onClick={() => runAction(onRotate)}>
            <RefreshCw size={15} />
            <span>New link</span>
          </button>
          <button role="menuitem" type="button" className="share-menu-danger" onClick={() => runAction(onDisable)}>
            <Link2Off size={15} />
            <span>Turn off link</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
