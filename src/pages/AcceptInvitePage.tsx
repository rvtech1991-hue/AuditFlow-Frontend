import { FormEvent, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/layout/AuthShell";
import { Button, FormField } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { mockInvite } from "../mock-data/auth";

export function AcceptInvitePage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const { acceptInvite } = useRole();
  const navigate = useNavigate();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords must match.");
      return;
    }
    acceptInvite(mockInvite.email, mockInvite.role);
    navigate("/dashboard", { replace: true });
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => setPassword(event.currentTarget.value);
  const handleConfirmPasswordChange = (event: ChangeEvent<HTMLInputElement>) => setConfirmPassword(event.currentTarget.value);

  return (
    <AuthShell
      browserUrl="app.auditflow.io/invite/accept?token=••••"
      copy={{
        quote: (
          <>
            You've been invited to join <b>{mockInvite.company}</b> on AuditFlow as an <b>{mockInvite.role}</b>.
          </>
        ),
        who: `Invited by ${mockInvite.inviterName} · ${mockInvite.inviterEmail}`,
      }}
    >
      <form className="signin-form" onSubmit={handleSubmit}>
        <h2>Set your password</h2>
        <p className="sub">This finishes setting up your account</p>
        <FormField label="Email" type="text" value={mockInvite.email} disabled />
        <FormField label="Create password" type="password" placeholder="At least 10 characters" value={password} onChange={handlePasswordChange} required />
        <FormField label="Confirm password" type="password" placeholder="Re-enter password" value={confirmPassword} onChange={handleConfirmPasswordChange} required />
        {error ? <p className="form-error">{error}</p> : null}
        <Button className="full-width auth-submit" variant="primary" type="submit">
          Activate account
        </Button>
        <p className="signin-footnote">By continuing, you agree this account is for your use only and audit activity is logged.</p>
      </form>
    </AuthShell>
  );
}
