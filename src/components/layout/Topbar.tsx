import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { routes } from "../../lib/routes";
import { useRole } from "../../lib/RoleContext";
import { API_MODE } from "../../lib/config";
import type { Role } from "../../types";
import { GlobalSearch } from "./GlobalSearch";
import { getUnreadCount } from "../../services/notifications";

const roleOptions: Role[] = ["Platform admin", "Auditor", "Company admin", "Employee"];

function matchTitle(pathname: string) {
  return routes.find((route) => route.path.includes(":") ? pathname.startsWith(route.path.split("/:")[0]) : route.path === pathname);
}

export function Topbar() {
  const location = useLocation();
  const route = matchTitle(location.pathname);
  const { role, setRole, user } = useRole();
  const isDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/executive";
  const canUseExecutive = role === "Auditor" || role === "Company admin";
  const executiveActive = location.pathname === "/dashboard/executive" || new URLSearchParams(location.search).get("view") === "executive";
  // Polling is a fine fallback for v1 (BACKEND_INTEGRATION_GUIDE SS8) — the SignalR hub is optional.
  const unreadCountQuery = useQuery({ queryKey: ["notifications", "unread-count"], queryFn: getUnreadCount, refetchInterval: 30_000 });
  const unreadCount = unreadCountQuery.data ?? 0;
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  return <header className="topbar"><div><h1 className="page-title">{route?.title ?? "AuditFlow"}</h1><p className="page-subtitle">{route?.subtitle ?? "Audit workspace foundation."}</p></div><div className="topbar-actions">{isDashboard && canUseExecutive ? <div className="segmented-toggle" role="group" aria-label="Dashboard view"><Link to="/dashboard" className={!executiveActive ? "active" : ""} aria-current={!executiveActive ? "page" : undefined}>Standard</Link><Link to="/dashboard?view=executive" className={executiveActive ? "active" : ""} aria-current={executiveActive ? "page" : undefined}>Executive</Link></div> : null}<GlobalSearch /><NavLink className="icon-btn" to="/notifications" aria-label="Notifications"><i className="ti ti-bell" />{unreadCount > 0 ? <span className="count-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</NavLink>{API_MODE === "mock" ? <div className="role-switcher"><button className={`role-switcher-trigger ${roleMenuOpen ? "is-open" : ""}`} type="button" aria-haspopup="menu" aria-expanded={roleMenuOpen} onClick={() => setRoleMenuOpen((open) => !open)}><span className="role-switcher-icon"><i className="ti ti-user-shield" /></span><span>{role}</span><i className={`ti ${roleMenuOpen ? "ti-chevron-up" : "ti-chevron-down"}`} /></button>{roleMenuOpen ? <div className="role-switcher-menu" role="menu">{roleOptions.map((option) => <button key={option} className={option === role ? "selected" : ""} type="button" role="menuitemradio" aria-checked={option === role} onClick={() => { setRole(option); setRoleMenuOpen(false); }}><i className={`ti ${option === "Platform admin" ? "ti-lock" : option === "Auditor" ? "ti-user-shield" : option === "Company admin" ? "ti-building" : "ti-user"}`} /><span>{option}</span>{option === role ? <i className="ti ti-check" /> : null}</button>)}</div> : null}</div> : <div className="role-switcher"><div className="role-switcher-trigger"><span className="role-switcher-icon"><i className="ti ti-user-shield" /></span><span>{role}</span></div></div>}<NavLink className="avatar topbar-avatar" to="/profile" title={`${user.name} profile`}>{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</NavLink></div></header>;
}
