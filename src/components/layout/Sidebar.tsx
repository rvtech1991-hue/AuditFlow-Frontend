import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { navItems } from "../../lib/routes";
import { useRole } from "../../lib/RoleContext";
import { getSummary } from "../../services/dashboard";
import type { NavItem } from "../../types";

const groups: NavItem["group"][] = ["Workspace", "Manage", "Platform"];

export function Sidebar() {
  const { user, role } = useRole();
  const visibleItems = navItems.filter((item) => item.roles.includes(role));
  // Same query key the Dashboard page uses — TanStack Query dedupes/shares the cached result
  // rather than firing a second request just because the sidebar renders on every page.
  const showTaskBadge = role !== "Platform admin";
  const summaryQuery = useQuery({ queryKey: ["dashboard", "summary"], queryFn: getSummary, enabled: showTaskBadge });
  const activeTaskCount = (summaryQuery.data?.openTasks ?? 0) + (summaryQuery.data?.inProgressTasks ?? 0);

  return (
    <aside className="sidebar">
      <NavLink to="/dashboard" className="brand">
        <span className="brand-mark"><i className="ti ti-shield-check" /></span>
        <span>AuditFlow</span>
      </NavLink>

      {groups.map((group) => {
        const items = visibleItems.filter((item) => item.group === group);
        if (!items.length) return null;
        return (
          <nav className="nav-group" key={group} aria-label={group}>
            <div className="nav-eyebrow">{group}</div>
            {items.map((item) => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <i className={`ti ${({ Dashboard: "ti-layout-dashboard", Tasks: "ti-checkbox", Reports: "ti-chart-bar", Companies: "ti-building", Users: "ti-users", "Auditor accounts": "ti-building-bank", Notifications: "ti-bell", Profile: "ti-user-circle" } as Record<string, string>)[item.label]}`} aria-hidden="true" />
                <span>{item.label}</span>
                {item.label === "Tasks" && activeTaskCount > 0 ? <span className="nav-badge">{activeTaskCount}</span> : null}
              </NavLink>
            ))}
          </nav>
        );
      })}

      <div className="sidebar-footer">
        <span className="avatar dark">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
        <span>
          <strong style={{ display: "block", color: "#fff" }}>{user.name}</strong>
          <small>{user.role}</small>
        </span>
      </div>
    </aside>
  );
}
