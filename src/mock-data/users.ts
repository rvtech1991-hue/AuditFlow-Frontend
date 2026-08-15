import type { Role } from "../types";

export type AuditUserStatus = "Invited" | "Active" | "Deactivated";

export type AuditUser = {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, "Platform admin">;
  company: string;
  subCompany: string;
  reportingManager: string;
  status: AuditUserStatus;
  invitedOn: string;
};

export type InviteUserInput = {
  name: string;
  email: string;
  role: AuditUser["role"];
  company: string;
  subCompany: string;
  reportingManager: string;
};

export const auditUsers: AuditUser[] = [
  {
    id: "USR-1001",
    name: "Rakesh Kumar",
    email: "rakesh@auditflow.test",
    role: "Auditor",
    company: "TaskFlow Firm",
    subCompany: "All client companies",
    reportingManager: "",
    status: "Active",
    invitedOn: "2026-01-02",
  },
  {
    id: "USR-1002",
    name: "Kavita Patel",
    email: "company.admin@meridian.com",
    role: "Company admin",
    company: "Meridian Group",
    subCompany: "All sub-companies",
    reportingManager: "",
    status: "Active",
    invitedOn: "2026-01-12",
  },
  {
    id: "USR-1003",
    name: "A. Verma",
    email: "a.verma@meridian.com",
    role: "Employee",
    company: "Meridian Group",
    subCompany: "Warehouse 3",
    reportingManager: "S. Nair",
    status: "Active",
    invitedOn: "2026-02-03",
  },
  {
    id: "USR-1004",
    name: "S. Nair",
    email: "s.nair@meridian.com",
    role: "Employee",
    company: "Meridian Group",
    subCompany: "North Finance",
    reportingManager: "",
    status: "Active",
    invitedOn: "2026-02-08",
  },
  {
    id: "USR-1005",
    name: "Dev Mehta",
    email: "dev@meridian.com",
    role: "Employee",
    company: "Meridian Group",
    subCompany: "South Plant",
    reportingManager: "Kavita Patel",
    status: "Invited",
    invitedOn: "2026-07-05",
  },
  {
    id: "USR-1006",
    name: "Anika Shah",
    email: "anika@kestrel.com",
    role: "Employee",
    company: "Kestrel Logistics",
    subCompany: "Depot East",
    reportingManager: "",
    status: "Active",
    invitedOn: "2026-04-19",
  },
  {
    id: "USR-1007",
    name: "J. Tan",
    email: "j.tan@kestrel.com",
    role: "Employee",
    company: "Kestrel Logistics",
    subCompany: "Depot West",
    reportingManager: "d.rao@kestrel.com",
    status: "Invited",
    invitedOn: "2026-07-07",
  },
  {
    id: "USR-1008",
    name: "Rahul Iyer",
    email: "rahul@patelco.com",
    role: "Employee",
    company: "Patel & Co.",
    subCompany: "Shared Services",
    reportingManager: "",
    status: "Deactivated",
    invitedOn: "2026-03-03",
  },
];

function nextUserId() {
  const max = auditUsers.reduce((latest, user) => {
    const numeric = Number(user.id.replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(latest, numeric) : latest;
  }, 1000);
  return `USR-${max + 1}`;
}

export function getUsersForRole(role: Role) {
  if (role === "Company admin") {
    return auditUsers.filter((user) => user.company === "Meridian Group");
  }
  if (role === "Auditor") return auditUsers;
  return [];
}

export function inviteUser(input: InviteUserInput) {
  const user: AuditUser = {
    id: nextUserId(),
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role,
    company: input.role === "Auditor" ? "TaskFlow Firm" : input.company,
    subCompany: input.role === "Auditor" ? "All client companies" : input.subCompany,
    reportingManager: input.reportingManager,
    status: "Invited",
    invitedOn: "2026-07-09",
  };
  auditUsers.unshift(user);
  return user;
}

export function deactivateUser(userId: string) {
  const user = auditUsers.find((item) => item.id === userId);
  if (!user) return undefined;
  user.status = "Deactivated";
  return user;
}

export function resendActivationLink(userId: string) {
  return auditUsers.find((item) => item.id === userId);
}

export function activateUser(userId: string) {
  const user = auditUsers.find((item) => item.id === userId);
  if (!user) return undefined;
  user.status = "Active";
  return user;
}
