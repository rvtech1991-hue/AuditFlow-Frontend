import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useRole } from "../../lib/RoleContext";

const navigation = [
  { to: "/admin/tenants", label: "Auditor accounts", icon: "ti-building-bank" },
  { to: "/admin/system", label: "System overview", icon: "ti-activity" },
  { to: "/admin/audit-log", label: "Audit log", icon: "ti-history" },
];

export function PlatformAdminShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, signOut } = useRole();
  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  return <div className="platform-app"><aside className="platform-sidebar"><NavLink to="/admin/tenants" className="platform-brand"><span className="platform-brand-mark"><i className="ti ti-lock" /></span><span>Platform admin</span></NavLink><nav className="platform-nav" aria-label="Platform navigation">{navigation.map((item) => <NavLink key={item.to} to={item.to} className={location.pathname.startsWith(item.to) ? "active" : ""}><i className={`ti ${item.icon}`} />{item.label}</NavLink>)}</nav><div className="platform-user"><span className="avatar platform-avatar">{initials}</span><span><strong>{user.name}</strong><small>Internal</small></span><button type="button" title="Log out" onClick={signOut}><i className="ti ti-logout" /></button></div></aside><main className="platform-main">{children}</main></div>;
}
