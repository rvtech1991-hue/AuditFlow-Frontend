import { FormEvent, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/layout/AuthShell";
import { Button, FormField } from "../components/ui";
import { ApiError } from "../lib/apiClient";
import { resetPassword } from "../services/auth";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords must match.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await resetPassword(email, token, newPassword);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewPasswordChange = (event: ChangeEvent<HTMLInputElement>) => setNewPassword(event.currentTarget.value);
  const handleConfirmPasswordChange = (event: ChangeEvent<HTMLInputElement>) => setConfirmPassword(event.currentTarget.value);

  if (!email || !token) {
    return (
      <AuthShell>
        <p className="form-error">This reset link is missing required information. Request a new one from the sign-in page.</p>
        <p className="signin-footnote">
          <Link to="/forgot-password">Back to forgot password</Link>
        </p>
      </AuthShell>
    );
  }

  if (submitted) {
    return (
      <AuthShell
        copy={{ quote: "Your password has been reset.", who: "TaskFlow account recovery" }}
      >
        <div className="signin-form">
          <h2>Password reset</h2>
          <div className="auth-confirmation">
            <span className="auth-confirmation-icon">✓</span>
            <p>Your password was updated. Sign in with your new password.</p>
          </div>
          <Button className="full-width auth-submit" variant="primary" type="button" onClick={() => navigate("/signin", { replace: true })}>
            Go to sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      copy={{ quote: "Choose a new password to finish resetting access to your account.", who: "TaskFlow account recovery" }}
    >
      <form className="signin-form" onSubmit={handleSubmit}>
        <h2>Reset your password</h2>
        <p className="sub">This finishes resetting the password for {email}</p>
        <FormField label="New password" type="password" placeholder="At least 10 characters" value={newPassword} onChange={handleNewPasswordChange} required />
        <FormField label="Confirm new password" type="password" placeholder="Re-enter new password" value={confirmPassword} onChange={handleConfirmPasswordChange} required />
        {error ? <p className="form-error">{error}</p> : null}
        <Button className="full-width auth-submit" variant="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Resetting..." : "Reset password"}
        </Button>
        <p className="signin-footnote">
          Remembered it? <Link to="/signin">Back to sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
