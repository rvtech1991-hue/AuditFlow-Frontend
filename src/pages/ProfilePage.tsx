import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, FormField, Toggle } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { API_MODE } from "../lib/config";
import { ApiError } from "../lib/apiClient";
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from "../lib/pushNotifications";
import { applyTheme } from "../lib/theme";
import { changeMyPassword, getMyTheme, updateMyTheme } from "../services/users";
import type { Theme } from "../services/users";
import { getNotificationPreferences, sendTestNotification, updateNotificationPreferences } from "../services/notifications";
import type { NotificationPreferences } from "../services/notifications";

const themeOptions: Array<{ value: Theme; label: string; icon: string }> = [{ value: "light", label: "Light", icon: "ti-sun" }, { value: "dark", label: "Dark", icon: "ti-moon" }, { value: "system", label: "System", icon: "ti-device-desktop" }];
const defaultPreferences: NotificationPreferences = { emailNotificationsEnabled: true, inAppNotificationsEnabled: true, dailyDigestEnabled: false, pushNotificationsEnabled: true };
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2);
const showDesktopToggle = API_MODE === "live" && isPushSupported();
// Mock mode has nothing to deliver a test notification through, same reasoning as push above.
const showTestNotification = API_MODE === "live";

export function ProfilePage() {
  const { user, signOut } = useRole(); const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(() => (window.localStorage.getItem("auditflow-theme") as Theme | null) ?? "light");
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [pushError, setPushError] = useState<string | null>(null);

  // Server is the source of truth for theme once authenticated (syncs across devices in live
  // mode); the useState above just avoids a flash of the wrong theme before this resolves.
  const themeQuery = useQuery({ queryKey: ["my-theme"], queryFn: getMyTheme });
  useEffect(() => {
    if (themeQuery.data && themeQuery.data !== theme) {
      setTheme(themeQuery.data);
      window.localStorage.setItem("auditflow-theme", themeQuery.data);
    }
  }, [themeQuery.data]);

  const preferencesQuery = useQuery({ queryKey: ["notification-preferences"], queryFn: getNotificationPreferences });
  useEffect(() => {
    if (preferencesQuery.data) setPreferences(preferencesQuery.data);
  }, [preferencesQuery.data]);

  const themeMutation = useMutation({ mutationFn: updateMyTheme });
  const preferencesMutation = useMutation({ mutationFn: updateNotificationPreferences });
  const testNotificationMutation = useMutation({ mutationFn: sendTestNotification });

  useEffect(() => { applyTheme(theme); }, [theme]);
  const logOut = () => { signOut(); navigate("/signin", { replace: true }); };
  const selectTheme = (next: Theme) => { setTheme(next); themeMutation.mutate(next); };
  const updatePreference = (patch: Partial<NotificationPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    preferencesMutation.mutate(next);
  };
  const togglePush = async (enabled: boolean) => {
    setPushError(null);
    try {
      if (enabled) await subscribeToPush();
      else await unsubscribeFromPush();
      updatePreference({ pushNotificationsEnabled: enabled });
    } catch (error) {
      setPushError(error instanceof Error ? error.message : "Couldn't update desktop notifications.");
    }
  };
  return <div className="profile-page"><section className="card profile-identity-card"><span className="avatar profile-avatar">{initials(user.name)}</span><div><h2>{user.name}</h2><p>{user.email} · {user.role}</p></div></section><section className="card profile-card"><h2 className="card-title">Appearance</h2><div className="theme-options" role="radiogroup" aria-label="Appearance theme">{themeOptions.map((option) => <button key={option.value} type="button" role="radio" aria-checked={theme === option.value} className={`chip ${theme === option.value ? "active-chip" : ""}`} onClick={() => selectTheme(option.value)}><i className={`ti ${option.icon}`} />{option.label}</button>)}</div>{themeMutation.isError ? <p className="form-error">Couldn't save your theme preference. It's still applied locally.</p> : null}</section><section className="card profile-card"><h2 className="card-title">Notifications</h2><Preference label="Email notifications" checked={preferences.emailNotificationsEnabled} onChange={(value) => updatePreference({ emailNotificationsEnabled: value })} /><Preference label="In-app notifications" checked={preferences.inAppNotificationsEnabled} onChange={(value) => updatePreference({ inAppNotificationsEnabled: value })} /><Preference label="Daily digest instead of instant email" checked={preferences.dailyDigestEnabled} onChange={(value) => updatePreference({ dailyDigestEnabled: value })} />{showDesktopToggle ? <Preference label="Desktop notifications (even when AuditFlow isn't focused)" checked={preferences.pushNotificationsEnabled} onChange={togglePush} /> : null}{preferencesMutation.isError ? <p className="form-error">Couldn't save your notification preferences.</p> : null}{pushError ? <p className="form-error">{pushError}</p> : null}{showTestNotification ? <div className="test-notification-row"><Button type="button" variant="default" disabled={testNotificationMutation.isPending} onClick={() => testNotificationMutation.mutate()}>{testNotificationMutation.isPending ? "Sending..." : "Send test notification"}</Button>{testNotificationMutation.isSuccess ? <p className="form-hint">Sent through whichever channels above are on — check your bell, inbox, and desktop.</p> : null}{testNotificationMutation.isError ? <p className="form-error">Couldn't send a test notification.</p> : null}</div> : null}</section><section className="card profile-card"><h2 className="card-title">Security</h2><PasswordSection /></section><button className="btn profile-logout" type="button" onClick={logOut}><i className="ti ti-logout" />Log out</button></div>;
}

function Preference({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="preference-row"><span>{label}</span><Toggle checked={checked} onChange={onChange} /></div>; }

function PasswordSection() {
  const { signOut } = useRole();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => changeMyPassword(currentPassword, newPassword, confirmPassword),
    onError: (err) => setError(err instanceof ApiError ? err.detail : "Couldn't change your password."),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < 10) {
      setError("New password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    mutation.mutate();
  };

  // Changing the password revokes every refresh token server-side (ChangeUserPasswordCommandHandler),
  // so this session dies on its next silent-refresh regardless — sign out proactively instead of
  // leaving a session on screen that looks fine but will break a moment later.
  if (mutation.isSuccess) {
    return (
      <div>
        <p className="form-hint">Password changed. Signing you out — sign back in with your new password.</p>
        <Button type="button" variant="primary" onClick={() => { signOut(); navigate("/signin", { replace: true }); }}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form className="password-form" onSubmit={handleSubmit}>
      <FormField label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event: ChangeEvent<HTMLInputElement>) => setCurrentPassword(event.currentTarget.value)} required />
      <FormField label="New password" type="password" autoComplete="new-password" placeholder="At least 10 characters" value={newPassword} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewPassword(event.currentTarget.value)} required />
      <FormField label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmPassword(event.currentTarget.value)} required />
      {error ? <p className="form-error">{error}</p> : null}
      <Button type="submit" variant="primary" disabled={mutation.isPending}>{mutation.isPending ? "Changing..." : "Change password"}</Button>
    </form>
  );
}
