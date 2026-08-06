import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "outline";
  size?: "default" | "small";
};

export function Button({ variant = "default", size = "default", className = "", ...props }: ButtonProps) {
  const variantClass = variant === "primary" ? "primary" : variant === "outline" ? "outline" : "";
  return <button className={`btn ${variantClass} ${size === "small" ? "sm" : ""} ${className}`} {...props} />;
}
