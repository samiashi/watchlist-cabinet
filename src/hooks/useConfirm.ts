import { useState } from "react";

export function useConfirm() {
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; resolve: (value: boolean) => void } | null>(null);

  function confirmAction(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      setConfirmDialog({ message, resolve });
    });
  }

  return { confirmDialog, setConfirmDialog, confirmAction };
}
