import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Toggle } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { getMyTheme, updateMyTheme } from "../services/users";
import type { Theme } from "../services/users";
import { getNotificationPreferences, updateNotificationPreferences } from "../services/notifications";
import type { NotificationPreferences } from "../services/notifications";

const themeOptions: Array<{ value: Theme; label: string; icon: string }> = [{ value: "light", label: "Light", icon: "ti-sun" }, { value: "dark", label: "Dark", icon: "ti-moon" }, { value: "system", label: "System", icon: "ti-device-desktop" }];
const defaultPreferences: NotificationPreferences = { emailNotificationsEnabled: true, inAppNotificationsEnabled: true, dailyDigestEnabled: false };
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2);

export function ProfilePage() {
  const { user, signOut } = useRole(); const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(() => (window.localStorage.getItem("auditflow-theme") as Theme | null) ?? "light");
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

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

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const logOut = () => { signOut(); navigate("/signin", { replace: true }); };
  const selectTheme = (next: Theme) => { setTheme(next); themeMutation.mutate(next); };
  const updatePreference = (patch: Partial<NotificationPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    preferencesMutation.mutate(next);
  };
  return <div className="profile-page"><section className="card profile-identity-card"><span className="avatar profile-avatar">{initials(user.name)}</span><div><h2>{user.name}</h2><p>{user.email} · {user.role}</p></div></section><section className="card profile-card"><h2 className="card-title">Appearance</h2><div className="theme-options" role="radiogroup" aria-label="Appearance theme">{themeOptions.map((option) => <button key={option.value} type="button" role="radio" aria-checked={theme === option.value} className={`chip ${theme === option.value ? "active-chip" : ""}`} onClick={() => selectTheme(option.value)}><i className={`ti ${option.icon}`} />{option.label}</button>)}</div>{themeMutation.isError ? <p className="form-error">Couldn't save your theme preference. It's still applied locally.</p> : null}</section><section className="card profile-card"><h2 className="card-title">Notifications</h2><Preference label="Email notifications" checked={preferences.emailNotificationsEnabled} onChange={(value) => updatePreference({ emailNotificationsEnabled: value })} /><Preference label="In-app notifications" checked={preferences.inAppNotificationsEnabled} onChange={(value) => updatePreference({ inAppNotificationsEnabled: value })} /><Preference label="Daily digest instead of instant email" checked={preferences.dailyDigestEnabled} onChange={(value) => updatePreference({ dailyDigestEnabled: value })} />{preferencesMutation.isError ? <p className="form-error">Couldn't save your notification preferences.</p> : null}</section><button className="btn profile-logout" type="button" onClick={logOut}><i className="ti ti-logout" />Log out</button></div>;
}

function Preference({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="preference-row"><span>{label}</span><Toggle checked={checked} onChange={onChange} /></div>; }
