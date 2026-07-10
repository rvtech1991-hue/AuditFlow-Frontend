import { NavLink } from "react-router-dom";
import { navItems } from "../../lib/routes";
import { useRole } from "../../lib/RoleContext";
import type { NavItem } from "../../types";

const groups: NavItem["group"][] = ["Workspace", "Manage", "Platform"];

export function Sidebar() {
  const { user, role } = useRole();
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="sidebar">
      <NavLink to="/dashboard" className="brand">
        <span className="brand-mark">A</span>
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
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
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
