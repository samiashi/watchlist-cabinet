export function ToastContainer({ toasts }: { toasts: Array<{ id: string; message: string; isExiting: boolean }> }) {
  return toasts.length ? (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.isExiting ? "is-exiting" : ""}`} role="status">
          {t.message}
        </div>
      ))}
    </div>
  ) : null;
}
