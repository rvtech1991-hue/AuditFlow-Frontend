import { apiClient, type PagedResult } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { mapRoleToUserRoleEnum, mapUserRoleEnum } from "../lib/roleMapping";
import {
  activateUser as mockActivateUser,
  deactivateUser as mockDeactivateUser,
  getUsersForRole as mockGetUsersForRole,
  inviteUser as mockInviteUser,
  resendActivationLink as mockResendActivationLink,
  type AuditUser,
  type AuditUserStatus,
} from "../mock-data/users";
import type { Role } from "../types";

export type { AuditUser, AuditUserStatus };

export type Theme = "light" | "dark" | "system";

function readLocalTheme(): Theme {
  return (window.localStorage.getItem("auditflow-theme") as Theme | null) ?? "light";
}

// Field names verified directly against the backend source (UserDtos.cs UserProfileResponse,
// UserCommands.cs) rather than guessed — GET /users/me returns { theme, ... }.
type RawUserProfile = { theme: Theme };

export async function getMyTheme(): Promise<Theme> {
  if (API_MODE === "mock") return readLocalTheme();
  const data = await apiClient.get<RawUserProfile>("/users/me");
  return data.theme;
}

export async function updateMyTheme(theme: Theme): Promise<void> {
  // Keep the device-local copy in sync regardless of mode, so the choice survives a refresh
  // even if the live PATCH call is slow or (in mock mode) doesn't exist.
  window.localStorage.setItem("auditflow-theme", theme);
  if (API_MODE === "mock") return;
  await apiClient.patch<void>("/users/me/theme", { theme });
}

export async function updateMyName(name: string): Promise<void> {
  if (API_MODE === "mock") {
    window.localStorage.setItem("auditflow-name", name);
    return;
  }
  // UpdateOwnProfileCommand's only field is `fullName`, not `name`.
  await apiClient.patch<void>("/users/me", { fullName: name });
}

export async function changeMyPassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
  if (API_MODE === "mock") return;
  await apiClient.post<void>("/users/me/password", { currentPassword, newPassword, confirmPassword });
}

// Field names verified directly against the backend source (UserDtos.cs, UserCommands.cs,
// UserQueries.cs) rather than guessed — see BACKEND_INTEGRATION_GUIDE SS8.
type RawUserListItem = {
  id: string;
  fullName: string;
  email: string;
  role: number;
  status: number;
  companyName: string;
  subCompanyName: string | null;
  reportingManagerName: string | null;
  createdAt: string;
};

const STATUS_FROM_ENUM: Record<number, AuditUserStatus> = { 1: "Invited", 2: "Active", 3: "Deactivated" };

function mapUserListItem(raw: RawUserListItem): AuditUser {
  return {
    id: raw.id,
    name: raw.fullName,
    email: raw.email,
    // GET /users only ever returns tenant users, never PlatformAdmin — safe to narrow here.
    role: mapUserRoleEnum(raw.role) as AuditUser["role"],
    company: raw.companyName,
    subCompany: raw.subCompanyName ?? "",
    reportingManager: raw.reportingManagerName ?? "",
    status: STATUS_FROM_ENUM[raw.status] ?? "Active",
    invitedOn: raw.createdAt.slice(0, 10),
  };
}

export async function getUsersForRole(role: Role): Promise<AuditUser[]> {
  if (API_MODE === "mock") return mockGetUsersForRole(role);
  const data = await apiClient.get<PagedResult<RawUserListItem>>("/users", { pageSize: 200 });
  return data.items.map(mapUserListItem);
}

export async function resendActivationLink(userId: string): Promise<void> {
  if (API_MODE === "mock") {
    mockResendActivationLink(userId);
    return;
  }
  await apiClient.post<void>(`/users/${userId}/resend-invite`);
}

export async function deactivateUser(userId: string, reason?: string): Promise<void> {
  if (API_MODE === "mock") {
    mockDeactivateUser(userId);
    return;
  }
  await apiClient.post<void>(`/users/${userId}/deactivate`, { reason });
}

export async function activateUser(userId: string): Promise<void> {
  if (API_MODE === "mock") {
    mockActivateUser(userId);
    return;
  }
  await apiClient.post<void>(`/users/${userId}/activate`);
}

export type InviteUserDraft = {
  name: string;
  email: string;
  role: AuditUser["role"];
  companyId: string;
  companyName: string;
  subCompanyId?: string;
  subCompanyName?: string;
  reportingManagerId?: string;
  reportingManagerName?: string;
};

export async function inviteUser(draft: InviteUserDraft): Promise<void> {
  if (API_MODE === "mock") {
    mockInviteUser({
      name: draft.name,
      email: draft.email,
      role: draft.role,
      company: draft.companyName,
      subCompany: draft.subCompanyName || "All sub-companies",
      reportingManager: draft.reportingManagerName || "",
    });
    return;
  }
  await apiClient.post<void>("/users/invite", {
    fullName: draft.name,
    email: draft.email,
    role: mapRoleToUserRoleEnum(draft.role),
    companyId: draft.companyId,
    subCompanyId: draft.subCompanyId || undefined,
    reportingManagerId: draft.reportingManagerId || undefined,
  });
}

export type ManagerOption = { id: string; name: string; company: string };

export async function getManagers(role: Role, companyId: string, companyName: string, excludeEmail?: string): Promise<ManagerOption[]> {
  if (API_MODE === "mock") {
    return mockGetUsersForRole(role)
      .filter((user) => user.status === "Active" && user.company === companyName && user.email !== excludeEmail)
      .map((user) => ({ id: user.id, name: user.name, company: user.company }));
  }
  const data = await apiClient.get<Array<{ id: string; fullName: string; companyName: string }>>("/users/managers", { companyId });
  return data.map((manager) => ({ id: manager.id, name: manager.fullName, company: manager.companyName }));
}

/** Documented for InviteUserPage (SS8) but not wired to an on-blur check in the current UI —
 * the invite form instead surfaces duplicate emails via the invite call's USER_EXISTS error
 * (SS4), matching how every other form in this app reports server-side conflicts. */
export async function checkEmailExists(email: string): Promise<boolean> {
  if (API_MODE === "mock") return false;
  const data = await apiClient.get<{ exists: boolean }>("/users/invite/validate-email", { email });
  return data.exists;
}
