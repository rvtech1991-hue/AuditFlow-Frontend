import type { ReactNode } from "react";
import { Button } from "./Button";

type ModalProps = {
  title: string;
  children: ReactNode;
  primaryLabel?: string;
  onClose?: () => void;
};

export function Modal({ title, children, primaryLabel = "Save", onClose }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2 className="card-title" style={{ margin: 0 }}>{title}</h2>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="modal-body">{children}</div>
        <footer className="modal-footer">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary">{primaryLabel}</Button>
        </footer>
      </section>
    </div>
  );
}
