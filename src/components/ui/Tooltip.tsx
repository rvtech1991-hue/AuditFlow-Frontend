import type { ReactNode } from "react";

type TooltipProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Wraps truncated text so the full value shows in a styled bubble on hover/focus, instead of
 * relying on the native `title` attribute (slow to appear and unstyled). */
export function Tooltip({ label, children, className = "" }: TooltipProps) {
  return (
    <span className={`tooltip-anchor ${className}`} tabIndex={0}>
      {children}
      <span className="tooltip-bubble" role="tooltip">{label}</span>
    </span>
  );
}
