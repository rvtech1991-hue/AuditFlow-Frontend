export type Role = "Platform admin" | "Auditor" | "Company admin" | "Employee";

export type Status = "open" | "progress" | "overdue" | "closed" | "active" | "invited";

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
  name: string;
  email: string;
  role: Role;
  status: "Active" | "Invited";
};

export type InviteDetails = {
  company: string;
  role: Role;
  inviterName: string;
  inviterEmail: string;
  email: string;
};
