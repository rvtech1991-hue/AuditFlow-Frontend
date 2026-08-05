import type { Role, User } from "../types";

export const mockUser: User = {
  id: "mock-user-auditor",
  name: "Rakesh Kumar",
  email: "rakesh@auditflow.test",
  role: "Auditor",
  status: "Active",
  tenantId: "mock-tenant-001",
};

export const mockInvite = {
  company: "Meridian Group",
  role: "Employee" as const,
  inviterName: "R. Sharma",
  inviterEmail: "a.verma@meridian.com",
  email: "a.verma@meridian.com",
};

function roleFromEmail(email: string): Role {
  const normalized = email.toLowerCase();
  if (normalized.includes("platform")) return "Platform admin";
  if (normalized.includes("company")) return "Company admin";
  if (normalized.includes("employee") || normalized.includes("verma")) return "Employee";
  return "Auditor";
}

function nameFromEmail(email: string) {
  const localPart = email.split("@")[0] || mockUser.name;
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Simulates a successful sign-in by pattern-matching the role from the email; password is
 * intentionally ignored, matching the previous RoleContext demo behavior. */
export function mockSignIn(email: string): User {
  const role = roleFromEmail(email);
  return { ...mockUser, id: `mock-${role.toLowerCase().replace(/\s+/g, "-")}`, email, name: nameFromEmail(email), role, tenantId: role === "Platform admin" ? null : "mock-tenant-001" };
}

export function mockAcceptInvite(): User {
  return { ...mockUser, id: "mock-invited-user", email: mockInvite.email, name: nameFromEmail(mockInvite.email), role: mockInvite.role, tenantId: "mock-tenant-001" };
}
