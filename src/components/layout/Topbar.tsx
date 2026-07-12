import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { routes } from "../../lib/routes";
import { useRole } from "../../lib/RoleContext";
import type { Role } from "../../types";
import { GlobalSearch } from "./GlobalSearch";

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
  const [unreadCount, setUnreadCount] = useState(() => Number(window.localStorage.getItem("auditflow-unread-notifications") ?? "2"));
  useEffect(() => { const update = () => setUnreadCount(Number(window.localStorage.getItem("auditflow-unread-notifications") ?? "0")); window.addEventListener("auditflow-notifications-read", update); return () => window.removeEventListener("auditflow-notifications-read", update); }, []);

  return <header className="topbar"><div><h1 className="page-title">{route?.title ?? "AuditFlow"}</h1><p className="page-subtitle">{route?.subtitle ?? "Audit workspace foundation."}</p></div><div className="topbar-actions">{isDashboard && canUseExecutive ? <div className="segmented-toggle" aria-label="Dashboard view"><NavLink to="/dashboard" className={!executiveActive ? "active" : ""}>Standard</NavLink><NavLink to="/dashboard?view=executive" className={executiveActive ? "active" : ""}>Executive</NavLink></div> : null}<GlobalSearch /><NavLink className="icon-button" to="/notifications" aria-label="Notifications"><i className="ti ti-bell" />{unreadCount > 0 ? <span className="unread-dot" /> : null}</NavLink><select className="search-box" style={{ width: 150 }} value={role} onChange={(event) => setRole(event.target.value as Role)} aria-label="Mock role">{roleOptions.map((option) => <option key={option}>{option}</option>)}</select><NavLink className="avatar topbar-avatar" to="/profile" title={`${user.name} profile`}>{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</NavLink></div></header>;
}
