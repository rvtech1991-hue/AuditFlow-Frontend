import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useRole } from "../../lib/RoleContext";
import { useClickOutside } from "../../lib/useClickOutside";

const navigation = [
  { to: "/admin/tenants", label: "Auditor accounts", icon: "ti-building-bank" },
  { to: "/admin/system", label: "System overview", icon: "ti-activity" },
  { to: "/admin/audit-log", label: "Audit log", icon: "ti-history" },
];

export function PlatformAdminShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useRole();
  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(avatarMenuRef, () => setAvatarMenuOpen(false), avatarMenuOpen);

  const logOut = () => {
    signOut();
    navigate("/signin", { replace: true });
  };

  return (
    <div className="platform-app">
      <aside className="platform-sidebar">
        <NavLink to="/admin/tenants" className="platform-brand">
          <span className="platform-brand-mark"><i className="ti ti-lock" /></span>
          <span>Platform admin</span>
        </NavLink>
        <nav className="platform-nav" aria-label="Platform navigation">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} className={location.pathname.startsWith(item.to) ? "active" : ""}>
              <i className={`ti ${item.icon}`} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="platform-user">
          <span className="avatar platform-avatar">{initials}</span>
          <span>
            <strong>{user.name}</strong>
            <small>Internal</small>
          </span>
          <button type="button" className="sidebar-logout" title="Log out" onClick={logOut}>
            <i className="ti ti-logout" />
          </button>
        </div>
      </aside>
      <main className="platform-main">
        <header className="topbar">
          <div />
          <div className="topbar-actions">
            <div className="avatar-menu-wrap" ref={avatarMenuRef}>
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
                      logOut();
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
        {children}
      </main>
    </div>
  );
}
