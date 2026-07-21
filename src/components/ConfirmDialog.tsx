import { useEffect } from "react";

export function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  return (
    <div className="confirm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label="Confirm">
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button className="button" type="button" onClick={onCancel}>Cancel</button>
          <button className="button button-danger" type="button" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
