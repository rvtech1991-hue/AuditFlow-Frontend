import type { Status } from "../types";

export const statusLabels: Record<Status, string> = {
  open: "Open",
  progress: "In progress",
  overdue: "Overdue",
  closed: "Closed",
  active: "Active",
  invited: "Invited",
};

export const statusStyles: Record<Status, { color: string; background: string }> = {
  open: { color: "var(--text-muted)", background: "#F2F4F8" },
  progress: { color: "var(--warning)", background: "var(--warning-bg)" },
  overdue: { color: "var(--danger)", background: "var(--danger-bg)" },
  closed: { color: "var(--success)", background: "var(--success-bg)" },
  active: { color: "var(--success)", background: "var(--success-bg)" },
  invited: { color: "var(--accent-600)", background: "var(--accent-100)" },
};
