import type { ReactNode } from "react";

type ChipProps = {
  children: ReactNode;
  active?: boolean;
};

export function Chip({ children, active = false }: ChipProps) {
  return <span className={`chip ${active ? "active-chip" : ""}`}>{children}</span>;
}
