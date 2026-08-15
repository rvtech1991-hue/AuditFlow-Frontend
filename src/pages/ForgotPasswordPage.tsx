import { FormEvent, useState } from "react";
import type { ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "../components/layout/AuthShell";
import { Button, FormField } from "../components/ui";
import { forgotPassword } from "../services/auth";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      // Always returns success regardless of whether the email exists (no user enumeration) —
      // per BACKEND_INTEGRATION_GUIDE SS5, so there's nothing to branch on here.
      await forgotPassword(email);
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => setEmail(event.currentTarget.value);

  return (
    <AuthShell
      copy={{
        quote: "Reset access without breaking the audit trail. Your activity, evidence, and sign-offs stay attached to your account.",
        who: "TaskFlow account recovery",
      }}
    >
      <form className="signin-form" onSubmit={handleSubmit}>
        <h2>{submitted ? "Check your email" : "Reset your password"}</h2>
        <p className="sub">
          {submitted ? "If an active TaskFlow account exists, a reset link has been sent." : "Enter your work email and we'll send a secure reset link."}
        </p>
        {submitted ? (
          <div className="auth-confirmation">
            <span className="auth-confirmation-icon">✓</span>
            <p>Use the link in the email to choose a new password. For security, the link expires automatically.</p>
          </div>
        ) : (
          <>
            <FormField label="Work email" type="email" placeholder="name@firm.com" value={email} onChange={handleEmailChange} required />
            <Button className="full-width auth-submit" variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send reset link"}
            </Button>
          </>
        )}
        <p className="signin-footnote">
          Remembered it? <Link to="/signin">Back to sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
