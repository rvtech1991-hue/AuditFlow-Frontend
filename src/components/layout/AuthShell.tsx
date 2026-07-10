import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type Testimonial = {
  quote: ReactNode;
  who: string;
};

const testimonials: Testimonial[] = [
  {
    quote: '"We cut our finding-to-resolution time by more than half once every audit task lived in one place."',
    who: "Head of Internal Audit, Meridian Group",
  },
  {
    quote: '"AuditFlow gave our teams one clean record for comments, documents, and sign-off."',
    who: "Audit Partner, Patel & Co.",
  },
  {
    quote: '"The strongest change was simple: every overdue finding finally had an owner."',
    who: "Finance Controller, Kestrel Logistics",
  },
];

type AuthShellProps = {
  browserUrl: string;
  children: ReactNode;
  copy?: Testimonial;
};

export function AuthShell({ browserUrl, children, copy }: AuthShellProps) {
  const [activeQuote, setActiveQuote] = useState(0);
  const testimonial = copy ?? testimonials[activeQuote];

  useEffect(() => {
    if (copy) return undefined;
    const timer = window.setInterval(() => {
      setActiveQuote((index) => (index + 1) % testimonials.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [copy]);

  return (
    <main className="auth-page">
      <section className="browser-chrome">
        <div className="chrome-bar">
          <span className="chrome-dot red" />
          <span className="chrome-dot amber" />
          <span className="chrome-dot green" />
          <span className="chrome-url">{browserUrl}</span>
        </div>
        <div className="signin-shell">
          <div className="signin-brand">
            <div className="brand auth-brand">
              <div className="brand-mark">A</div>
              <span>AuditFlow</span>
            </div>
            <div>
              <p className="signin-quote">{testimonial.quote}</p>
              <p className="signin-quote who">{testimonial.who}</p>
            </div>
          </div>
          <div className="signin-form-wrap">{children}</div>
        </div>
      </section>
    </main>
  );
}
