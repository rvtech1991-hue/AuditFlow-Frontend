import type { NavItem, RouteMeta } from "../types";

export const routes: RouteMeta[] = [
  { path: "/signin", title: "Sign in", subtitle: "Public authentication entry point.", access: "Public", public: true },
  { path: "/invite/accept", title: "Accept invite", subtitle: "Set a password from a secure invite link.", access: "Public", public: true },
  { path: "/forgot-password", title: "Forgot password", subtitle: "Request a reset link for an existing account.", access: "Public", public: true },
  { path: "/reset-password", title: "Reset password", subtitle: "Set a new password from a secure reset link.", access: "Public", public: true },
  { path: "/dashboard", title: "Dashboard", subtitle: "Role-aware standard dashboard.", access: ["Auditor", "Company admin", "Employee"] },
  { path: "/dashboard/executive", title: "Executive dashboard", subtitle: "Portfolio summary with global filters.", access: ["Auditor", "Company admin"] },
  { path: "/tasks", title: "Tasks", subtitle: "Current-week task grid, scoped by role.", access: ["Auditor", "Company admin", "Employee"] },
  { path: "/tasks/all", title: "All tasks", subtitle: "All-time task grid across scoped companies.", access: ["Auditor", "Company admin", "Employee"] },
  { path: "/tasks/new", title: "Create new task", subtitle: "Auditor-only task creation modal route.", access: ["Auditor"] },
  { path: "/tasks/bulk-upload", title: "Bulk create tasks", subtitle: "Excel import workflow placeholder.", access: ["Auditor"] },
  { path: "/tasks/:taskId", title: "Task details", subtitle: "Overview, comments, documents, status history, and audit timeline.", access: ["Auditor", "Company admin", "Employee"] },
  { path: "/reports", title: "Reports", subtitle: "Filter, review, and export scoped task data.", access: ["Auditor", "Company admin", "Employee"] },
  { path: "/companies", title: "Company management", subtitle: "Company and sub-company list.", access: ["Auditor", "Company admin"] },
  { path: "/companies/new", title: "Add company", subtitle: "Company and nested sub-company creation route.", access: ["Auditor"] },
  { path: "/companies/:companyId/edit", title: "Edit company", subtitle: "Company and nested sub-company edit route.", access: ["Auditor"] },
  { path: "/users", title: "User management", subtitle: "Tenant user table placeholder.", access: ["Auditor", "Company admin"] },
  { path: "/users/new", title: "Invite user", subtitle: "Invite flow placeholder.", access: ["Auditor", "Company admin"] },
  { path: "/notifications", title: "Notifications", subtitle: "Notification center placeholder.", access: ["Platform admin", "Auditor", "Company admin", "Employee"] },
  { path: "/profile", title: "Profile", subtitle: "Identity, theme, notification preferences, and logout.", access: ["Platform admin", "Auditor", "Company admin", "Employee"] },
  { path: "/admin/tenants", title: "Auditor accounts", subtitle: "Platform admin tenant management placeholder.", access: ["Platform admin"] },
  { path: "/admin/tenants/new", title: "Create auditor account", subtitle: "Provision an audit-firm tenant.", access: ["Platform admin"] },
  { path: "/admin/tenants/:tenantId", title: "Tenant overview", subtitle: "Subscription, usage, and contacts.", access: ["Platform admin"] },
  { path: "/admin/system", title: "System overview", subtitle: "Platform health and tenant usage.", access: ["Platform admin"] },
  { path: "/admin/audit-log", title: "Audit log", subtitle: "Platform administrative activity.", access: ["Platform admin"] },
];

export const navItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", roles: ["Auditor", "Company admin", "Employee"], group: "Workspace", icon: "▦" },
  { label: "Tasks", path: "/tasks", roles: ["Auditor", "Company admin", "Employee"], group: "Workspace", icon: "☑" },
  { label: "Reports", path: "/reports", roles: ["Auditor", "Company admin", "Employee"], group: "Workspace", icon: "◷" },
  { label: "Companies", path: "/companies", roles: ["Auditor", "Company admin"], group: "Manage", icon: "▣" },
  { label: "Users", path: "/users", roles: ["Auditor", "Company admin"], group: "Manage", icon: "◉" },
  { label: "Auditor accounts", path: "/admin/tenants", roles: ["Platform admin"], group: "Platform", icon: "◆" },
  { label: "Notifications", path: "/notifications", roles: ["Platform admin", "Auditor", "Company admin", "Employee"], group: "Platform", icon: "◌" },
];
