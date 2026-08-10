import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { routes } from "../../lib/routes";
import { useRole } from "../../lib/RoleContext";
import { API_MODE } from "../../lib/config";
import type { Role } from "../../types";
import { GlobalSearch } from "./GlobalSearch";
import { getUnreadCount } from "../../services/notifications";

const roleOptions: Role[] = ["Platform admin", "Auditor", "Company admin", "Employee"];

function matchTitle(pathname: string) {
  return routes.find((route) => (route.path.includes(":") ? pathname.startsWith(route.path.split("/:")[0]) : route.path === pathname));
}

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const route = matchTitle(location.pathname);
  const { role, setRole, user, signOut } = useRole();
  const isDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/executive";
  const canUseExecutive = role === "Auditor" || role === "Company admin";
  const executiveActive = location.pathname === "/dashboard/executive" || new URLSearchParams(location.search).get("view") === "executive";
  // SignalR (src/lib/notificationHub.ts) pushes live updates and invalidates this query instantly;
  // this poll is just a passive backstop in case a connection drops silently.
  const unreadCountQuery = useQuery({ queryKey: ["notifications", "unread-count"], queryFn: getUnreadCount, refetchInterval: 300_000 });
  const unreadCount = unreadCountQuery.data ?? 0;
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2);

  return (
    <header className="topbar">
      <div>
        <h1 className="page-title">{route?.title ?? "AuditFlow"}</h1>
        <p className="page-subtitle">{route?.subtitle ?? "Audit workspace foundation."}</p>
      </div>
      <div className="topbar-actions">
        {isDashboard && canUseExecutive ? (
          <div className="segmented-toggle" role="group" aria-label="Dashboard view">
            <Link to="/dashboard" className={!executiveActive ? "active" : ""} aria-current={!executiveActive ? "page" : undefined}>Standard</Link>
            <Link to="/dashboard?view=executive" className={executiveActive ? "active" : ""} aria-current={executiveActive ? "page" : undefined}>Executive</Link>
          </div>
        ) : null}

        <GlobalSearch />

        <NavLink className="icon-btn" to="/notifications" aria-label="Notifications">
          <i className="ti ti-bell" />
          {unreadCount > 0 ? <span className="count-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
        </NavLink>

        {API_MODE === "mock" ? (
          <div className="role-switcher">
            <button
              className={`role-switcher-trigger ${roleMenuOpen ? "is-open" : ""}`}
              type="button"
              aria-haspopup="menu"
              aria-expanded={roleMenuOpen}
              onClick={() => setRoleMenuOpen((open) => !open)}
            >
              <span className="role-switcher-icon"><i className="ti ti-user-shield" /></span>
              <span>{role}</span>
              <i className={`ti ${roleMenuOpen ? "ti-chevron-up" : "ti-chevron-down"}`} />
            </button>
            {roleMenuOpen ? (
              <div className="role-switcher-menu" role="menu">
                {roleOptions.map((option) => (
                  <button
                    key={option}
                    className={option === role ? "selected" : ""}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option === role}
                    onClick={() => {
                      setRole(option);
                      setRoleMenuOpen(false);
                    }}
                  >
                    <i className={`ti ${option === "Platform admin" ? "ti-lock" : option === "Auditor" ? "ti-user-shield" : option === "Company admin" ? "ti-building" : "ti-user"}`} />
                    <span>{option}</span>
                    {option === role ? <i className="ti ti-check" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="role-switcher">
            <div className="role-switcher-trigger">
              <span className="role-switcher-icon"><i className="ti ti-user-shield" /></span>
              <span>{role}</span>
            </div>
          </div>
        )}

        <div className="avatar-menu-wrap">
          <button
            className={`avatar topbar-avatar ${avatarMenuOpen ? "is-open" : ""}`}
            type="button"
            aria-haspopup="menu"
            aria-expanded={avatarMenuOpen}
            title={`${user.name} account menu`}
            onClick={() => setAvatarMenuOpen((open) => !open)}
          >
            {initials}
          </button>
          {avatarMenuOpen ? (
            <div className="avatar-menu" role="menu">
              <div className="avatar-menu-identity">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAvatarMenuOpen(false);
                  navigate("/profile");
                }}
              >
                <i className="ti ti-user-circle" />
                <span>View profile</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setAvatarMenuOpen(false);
                  signOut();
                  navigate("/signin", { replace: true });
                }}
              >
                <i className="ti ti-logout" />
                <span>Log out</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
