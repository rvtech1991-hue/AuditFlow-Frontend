import { FormEvent, useState } from "react";
import type { ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "../components/layout/AuthShell";
import { Button, FormField } from "../components/ui";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => setEmail(event.currentTarget.value);

  return (
    <AuthShell
      browserUrl="app.auditflow.io/forgot-password"
      copy={{
        quote: "Reset access without breaking the audit trail. Your activity, evidence, and sign-offs stay attached to your account.",
        who: "AuditFlow account recovery",
      }}
    >
      <form className="signin-form" onSubmit={handleSubmit}>
        <h2>{submitted ? "Check your email" : "Reset your password"}</h2>
        <p className="sub">
          {submitted ? "If an active AuditFlow account exists, a reset link has been sent." : "Enter your work email and we'll send a secure reset link."}
        </p>
        {submitted ? (
          <div className="auth-confirmation">
            <span className="auth-confirmation-icon">✓</span>
            <p>Use the link in the email to choose a new password. For security, the link expires automatically.</p>
          </div>
        ) : (
          <>
            <FormField label="Work email" type="email" placeholder="name@firm.com" value={email} onChange={handleEmailChange} required />
            <Button className="full-width auth-submit" variant="primary" type="submit">
              Send reset link
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
