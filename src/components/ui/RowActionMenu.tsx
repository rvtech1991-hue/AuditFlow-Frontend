import { useState } from "react";

type Action = { label: string; icon: string; destructive?: boolean; dividerBefore?: boolean; onClick?: () => void };
const iconClass: Record<string, string> = { Edit: "ti-pencil", Archive: "ti-archive", Restore: "ti-refresh", Send: "ti-send", Deactivate: "ti-user-off" };

export function RowActionMenu({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false);
  return <span className="row-action"><button className={`menu-btn ${open ? "is-open" : ""}`} type="button" aria-label="Row actions" aria-expanded={open} onClick={() => setOpen((value) => !value)}><i className="ti ti-dots" /></button>{open ? <span className="row-menu" role="menu">{actions.map((action) => <span key={action.label}>{action.dividerBefore ? <span className="menu-divider" /> : null}<button className={`menu-item ${action.destructive ? "danger" : ""}`} type="button" role="menuitem" onClick={() => { action.onClick?.(); setOpen(false); }}><i className={`ti ${iconClass[action.icon] ?? "ti-circle"}`} />{action.label}</button></span>)}</span> : null}</span>;
}
