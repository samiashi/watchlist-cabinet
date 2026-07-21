import { useState } from "react";

export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; isExiting: boolean }>>([]);

  function showToast(message: string) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    setToasts((current) => [...current, { id, message, isExiting: false }]);
    setTimeout(() => {
      setToasts((current) =>
        current.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
      );
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, 200);
    }, 2200);
  }

  return { toasts, showToast };
}
