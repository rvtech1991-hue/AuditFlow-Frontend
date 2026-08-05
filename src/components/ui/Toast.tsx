import { useEffect } from "react";

export type ToastKind = "success" | "error";

export type ToastState = { kind: ToastKind; message: string } | null;

type ToastProps = {
  toast: ToastState;
  onDismiss: () => void;
  duration?: number;
};

export function Toast({ toast, onDismiss, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss, duration]);

  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.kind}`} role="status">
      <i className={`ti ${toast.kind === "success" ? "ti-circle-check" : "ti-alert-circle"}`} />
      <span>{toast.message}</span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}><i className="ti ti-x" /></button>
    </div>
  );
}
