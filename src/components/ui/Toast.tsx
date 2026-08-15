import { useEffect } from "react";

export type ToastKind = "success" | "error";

export type ToastAction = { label: string; onClick: () => void };

export type ToastState = { kind: ToastKind; message: string; action?: ToastAction } | null;

type ToastProps = {
  toast: ToastState;
  onDismiss: () => void;
  duration?: number;
};

export function Toast({ toast, onDismiss, duration }: ToastProps) {
  // A toast offering an action (e.g. "Undo") gets longer on-screen time by default — the whole
  // point is giving someone a real window to click it, not just a status message flashing by.
  const effectiveDuration = duration ?? (toast?.action ? 6000 : 4000);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, effectiveDuration);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss, effectiveDuration]);

  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.kind}`} role="status">
      <i className={`ti ${toast.kind === "success" ? "ti-circle-check" : "ti-alert-circle"}`} />
      <span>{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action!.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
      <button type="button" aria-label="Dismiss" onClick={onDismiss}><i className="ti ti-x" /></button>
    </div>
  );
}
