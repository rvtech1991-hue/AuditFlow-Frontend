import { statusLabels, statusStyles } from "../../lib/status";
import type { Status } from "../../types";

type BadgeProps = {
  status: Status;
  label?: string;
};

export function Badge({ status, label }: BadgeProps) {
  const style = statusStyles[status];
  return (
    <span className="badge" style={{ color: style.color, background: style.background }}>
      <span className="badge-dot" />
      {label ?? statusLabels[status]}
    </span>
  );
}
