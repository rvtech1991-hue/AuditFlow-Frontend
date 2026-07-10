import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary";
  size?: "default" | "small";
};

export function Button({ variant = "default", size = "default", className = "", ...props }: ButtonProps) {
  return <button className={`btn ${variant === "primary" ? "primary" : ""} ${size === "small" ? "sm" : ""} ${className}`} {...props} />;
}
