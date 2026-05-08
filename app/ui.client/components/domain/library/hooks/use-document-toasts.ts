import { useCallback, useState } from "react";

export type ToastTone = "error" | "info" | "success";

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

export interface UseDocumentToastsApi {
  toasts: Toast[];
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

export function useDocumentToasts(): UseDocumentToastsApi {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((toast: Omit<Toast, "id">): void => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { ...toast, id }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id: string): void => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  return { toasts, pushToast, dismissToast };
}
