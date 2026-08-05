import { FormEvent, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/layout/AuthShell";
import { Button, FormField } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { ApiError } from "../lib/apiClient";

export function SignInPage() {
  const [email, setEmail] = useState("auditor@auditflow.test");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn } = useRole();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password, rememberMe);
      // Always land on the dashboard after sign-in, regardless of what page originally
      // redirected here unauthenticated — a consistent landing spot beats resuming a deep link.
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => setEmail(event.currentTarget.value);
  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => setPassword(event.currentTarget.value);
  const handleRememberMeChange = (event: ChangeEvent<HTMLInputElement>) => setRememberMe(event.currentTarget.checked);

  return (
    <AuthShell>
      <form className="signin-form" onSubmit={handleSubmit}>
        <h2>Welcome back</h2>
        <p className="sub">Sign in to your organization's workspace</p>
        <FormField label="Work email" type="email" placeholder="name@firm.com" value={email} onChange={handleEmailChange} required />
        <FormField label="Password" type="password" placeholder="••••••••••" value={password} onChange={handlePasswordChange} required />
        <div className="signin-row">
          <label>
            <input type="checkbox" checked={rememberMe} onChange={handleRememberMeChange} />
            Keep me signed in
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <Button className="full-width" variant="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
        <p className="signin-footnote">Don't have access yet? Ask your auditor or company admin to add you.</p>
      </form>
    </AuthShell>
  );
}
