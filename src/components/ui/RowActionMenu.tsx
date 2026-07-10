import { useState } from "react";

type Action = {
  label: string;
  icon: string;
  destructive?: boolean;
  dividerBefore?: boolean;
  onClick?: () => void;
};

export function RowActionMenu({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="row-action">
      <button className="row-action-trigger" type="button" aria-label="Row actions" onClick={() => setOpen((value) => !value)}>
        ···
      </button>
      {open ? (
        <span className="row-menu">
          {actions.map((action) => (
            <span key={action.label}>
              {action.dividerBefore ? <span className="row-menu-divider" /> : null}
              <button className={`row-menu-item ${action.destructive ? "destructive" : ""}`} type="button" onClick={action.onClick}>
                <span>{action.icon}</span>
                {action.label}
              </button>
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
