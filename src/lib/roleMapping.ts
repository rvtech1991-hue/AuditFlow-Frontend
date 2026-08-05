import type { Role } from "../types";

/** Backend JWT role claim string -> frontend display Role (BACKEND_INTEGRATION_GUIDE SS5). */
const ROLE_FROM_CLAIM: Record<string, Role> = {
  PlatformAdmin: "Platform admin",
  Auditor: "Auditor",
  CompanyAdmin: "Company admin",
  Employee: "Employee",
};

/** UserRole enum value (as returned by /api/v1/users) -> frontend display Role (SS7). */
const ROLE_FROM_ENUM_VALUE: Record<number, Role> = {
  1: "Platform admin",
  2: "Auditor",
  3: "Company admin",
  4: "Employee",
};

export function mapBackendRole(backendRoleClaim: string): Role {
  const role = ROLE_FROM_CLAIM[backendRoleClaim];
  if (!role) throw new Error(`Unrecognized backend role claim: "${backendRoleClaim}"`);
  return role;
}

export function mapUserRoleEnum(value: number): Role {
  const role = ROLE_FROM_ENUM_VALUE[value];
  if (!role) throw new Error(`Unrecognized UserRole enum value: ${value}`);
  return role;
}

const ENUM_VALUE_FROM_ROLE: Record<Role, number> = {
  "Platform admin": 1,
  Auditor: 2,
  "Company admin": 3,
  Employee: 4,
};

export function mapRoleToUserRoleEnum(role: Role): number {
  return ENUM_VALUE_FROM_ROLE[role];
}
