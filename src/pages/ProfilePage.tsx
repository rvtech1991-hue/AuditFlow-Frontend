import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toggle } from "../components/ui";
import { useRole } from "../lib/RoleContext";

type Theme = "light" | "dark" | "system";
type Preferences = { email: boolean; inApp: boolean; digest: boolean };
const themeOptions: Array<{ value: Theme; label: string; icon: string }> = [{ value: "light", label: "Light", icon: "ti-sun" }, { value: "dark", label: "Dark", icon: "ti-moon" }, { value: "system", label: "System", icon: "ti-device-desktop" }];
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2);

export function ProfilePage() {
  const { user, signOut } = useRole(); const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(() => (window.localStorage.getItem("auditflow-theme") as Theme | null) ?? "light");
  const [preferences, setPreferences] = useState<Preferences>(() => { const saved = window.localStorage.getItem("auditflow-notification-preferences"); return saved ? JSON.parse(saved) as Preferences : { email: true, inApp: true, digest: false }; });
  useEffect(() => { window.localStorage.setItem("auditflow-theme", theme); document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { window.localStorage.setItem("auditflow-notification-preferences", JSON.stringify(preferences)); }, [preferences]);
  const logOut = () => { signOut(); navigate("/signin", { replace: true }); };
  return <div className="profile-page"><section className="card profile-identity-card"><span className="avatar profile-avatar">{initials(user.name)}</span><div><h2>{user.name}</h2><p>{user.email} · {user.role}</p></div></section><section className="card profile-card"><h2 className="card-title">Appearance</h2><div className="theme-options" role="radiogroup" aria-label="Appearance theme">{themeOptions.map((option) => <button key={option.value} type="button" role="radio" aria-checked={theme === option.value} className={`chip ${theme === option.value ? "active-chip" : ""}`} onClick={() => setTheme(option.value)}><i className={`ti ${option.icon}`} />{option.label}</button>)}</div></section><section className="card profile-card"><h2 className="card-title">Notifications</h2><Preference label="Email notifications" checked={preferences.email} onChange={(email) => setPreferences((current) => ({ ...current, email }))} /><Preference label="In-app notifications" checked={preferences.inApp} onChange={(inApp) => setPreferences((current) => ({ ...current, inApp }))} /><Preference label="Daily digest instead of instant email" checked={preferences.digest} onChange={(digest) => setPreferences((current) => ({ ...current, digest }))} /></section><button className="btn profile-logout" type="button" onClick={logOut}><i className="ti ti-logout" />Log out</button></div>;
}

function Preference({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="preference-row"><span>{label}</span><Toggle checked={checked} onChange={onChange} /></div>; }
