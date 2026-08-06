export type Role = "Platform admin" | "Auditor" | "Company admin" | "Employee";

// "resolved"/"reopened" are real backend AuditTaskStatus values (awaiting auditor sign-off, and
// reopened-with-reason respectively) — don't collapse them into "progress"/"closed" when mapping
// live task data (BACKEND_INTEGRATION_GUIDE SS7). "overdue" isn't a backend status at all; it's a
// derived UI badge computed from task.isOverdue, given display precedence over the real status.
export type Status = "open" | "progress" | "resolved" | "reopened" | "overdue" | "closed" | "active" | "invited" | "deactivated";

export type RouteMeta = {
  path: string;
  title: string;
  subtitle: string;
  access: "Public" | Role[];
  public?: boolean;
};

export type NavItem = {
  label: string;
  path: string;
  roles: Role[];
  group: "Workspace" | "Manage" | "Platform";
  icon: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "Active" | "Invited";
  /** Null for PlatformAdmin, which has no tenant (see BACKEND_INTEGRATION_GUIDE SS1/SS5). */
  tenantId: string | null;
  companyId?: string;
  subCompanyId?: string;
};

export type InviteDetails = {
  company: string;
  role: Role;
  inviterName: string;
  inviterEmail: string;
  email: string;
};
