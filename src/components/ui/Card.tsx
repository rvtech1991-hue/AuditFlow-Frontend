import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <section className={`card card-pad ${className}`}>
      {title ? <h2 className="card-title">{title}</h2> : null}
      {children}
    </section>
  );
}
