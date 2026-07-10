import { FormEvent, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/layout/AuthShell";
import { Button, FormField } from "../components/ui";
import { useRole } from "../lib/RoleContext";

export function SignInPage() {
  const [email, setEmail] = useState("auditor@auditflow.test");
  const [password, setPassword] = useState("");
  const { signIn } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    signIn(email);
    navigate(redirectTo, { replace: true });
  };

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => setEmail(event.currentTarget.value);
  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => setPassword(event.currentTarget.value);

  return (
    <AuthShell browserUrl="app.auditflow.io/signin">
      <form className="signin-form" onSubmit={handleSubmit}>
        <h2>Welcome back</h2>
        <p className="sub">Sign in to your organization's workspace</p>
        <FormField label="Work email" type="email" placeholder="name@firm.com" value={email} onChange={handleEmailChange} required />
        <FormField label="Password" type="password" placeholder="••••••••••" value={password} onChange={handlePasswordChange} required />
        <div className="signin-row">
          <label>
            <input type="checkbox" />
            Keep me signed in
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <Button className="full-width" variant="primary" type="submit">
          Sign in
        </Button>
        <p className="signin-footnote">Don't have access yet? Ask your auditor or company admin to add you.</p>
      </form>
    </AuthShell>
  );
}
