import { FormEvent, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AuthShell } from "../components/layout/AuthShell";
import { Button, FormField } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { ApiError } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { mockInvite } from "../mock-data/auth";
import { validateInvite } from "../services/auth";

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { acceptInvite } = useRole();
  const navigate = useNavigate();

  const inviteQuery = useQuery({
    queryKey: ["invite", token],
    queryFn: () => validateInvite(token),
    enabled: API_MODE === "live" && token.length > 0,
    retry: false,
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords must match.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await acceptInvite(token, password, confirmPassword);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => setPassword(event.currentTarget.value);
  const handleConfirmPasswordChange = (event: ChangeEvent<HTMLInputElement>) => setConfirmPassword(event.currentTarget.value);

  if (inviteQuery.isLoading) {
    return (
      <AuthShell>
        <p className="sub">Checking your invite link...</p>
      </AuthShell>
    );
  }

  if (API_MODE === "live" && (inviteQuery.isError || !token)) {
    const detail = inviteQuery.error instanceof ApiError ? inviteQuery.error.detail : "This invite link is invalid or has expired.";
    return (
      <AuthShell>
        <p className="form-error">{detail}</p>
      </AuthShell>
    );
  }

  const invite = {
    email: inviteQuery.data?.email ?? mockInvite.email,
    companyName: inviteQuery.data?.companyName ?? mockInvite.company,
    role: inviteQuery.data?.role ?? mockInvite.role,
  };
  // The backend's invite-validate response doesn't include inviter name/email (SS5) — only the
  // mock fixture does, so the "who invited you" line only shows in mock mode.
  const inviterWho = inviteQuery.data ? "You were invited to join this workspace." : `Invited by ${mockInvite.inviterName} · ${mockInvite.inviterEmail}`;

  return (
    <AuthShell
      copy={{
        quote: (
          <>
            You've been invited to join <b>{invite.companyName}</b> on AuditFlow as an <b>{invite.role}</b>.
          </>
        ),
        who: inviterWho,
      }}
    >
      <form className="signin-form" onSubmit={handleSubmit}>
        <h2>Set your password</h2>
        <p className="sub">This finishes setting up your account</p>
        <FormField label="Email" type="text" value={invite.email} disabled />
        <FormField label="Create password" type="password" placeholder="At least 10 characters" value={password} onChange={handlePasswordChange} required />
        <FormField label="Confirm password" type="password" placeholder="Re-enter password" value={confirmPassword} onChange={handleConfirmPasswordChange} required />
        {error ? <p className="form-error">{error}</p> : null}
        <Button className="full-width auth-submit" variant="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Activating..." : "Activate account"}
        </Button>
        <p className="signin-footnote">By continuing, you agree this account is for your use only and audit activity is logged.</p>
      </form>
    </AuthShell>
  );
}
