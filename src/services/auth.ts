import { apiClient, ApiError } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { clearTokens, getRefreshToken, setTokens } from "../lib/tokenStorage";
import { decodeAccessToken } from "../lib/jwt";
import { mapBackendRole, mapUserRoleEnum } from "../lib/roleMapping";
import { mockAcceptInvite, mockInvite, mockSignIn } from "../mock-data/auth";
import type { Role, User } from "../types";

type TokenPairResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  requiresMfa: boolean;
};

export type InviteDetails = {
  invitationId: string;
  email: string;
  companyName: string;
  subCompanyName?: string;
  role: Role;
  expiresAt: string;
};

function userFromAccessToken(accessToken: string): User {
  const claims = decodeAccessToken(accessToken);
  return {
    id: claims.userId,
    name: claims.fullName,
    email: claims.email,
    role: mapBackendRole(claims.role),
    // Login/accept-invite responses don't carry a documented `status` field on `user` in the
    // guide — a successfully authenticated (non-invited) account is always Active.
    status: "Active",
    tenantId: claims.tenantId,
    companyId: claims.companyId,
    subCompanyId: claims.subCompanyId,
  };
}

export async function login(email: string, password: string, rememberMe?: boolean): Promise<User> {
  if (API_MODE === "mock") {
    return mockSignIn(email);
  }

  const data = await apiClient.post<TokenPairResponse>("/auth/login", { email, password, rememberMe }, undefined, { skipAuth: true });

  if (data.requiresMfa) {
    // No MFA-verification UI exists in this app yet — fail loudly rather than silently
    // leaving the session half-authenticated with no token stored.
    throw new ApiError({
      status: 200,
      errorCode: "MFA_REQUIRED",
      detail: "This account requires multi-factor authentication, which isn't supported in this app yet.",
    });
  }

  setTokens(data.accessToken, data.refreshToken, rememberMe);
  return userFromAccessToken(data.accessToken);
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (API_MODE === "live" && refreshToken) {
    try {
      await apiClient.post("/auth/logout", { refreshToken });
    } catch {
      // Best-effort — still clear the local session even if the server call fails.
    }
  }
  clearTokens();
}

export async function forgotPassword(email: string): Promise<void> {
  if (API_MODE === "mock") return;
  await apiClient.post<void>("/auth/forgot-password", { email }, undefined, { skipAuth: true });
}

export async function resetPassword(email: string, token: string, newPassword: string): Promise<void> {
  if (API_MODE === "mock") return;
  await apiClient.post<void>("/auth/reset-password", { email, token, newPassword }, undefined, { skipAuth: true });
}

export async function validateInvite(token: string): Promise<InviteDetails> {
  if (API_MODE === "mock") {
    return {
      invitationId: "mock-invite",
      email: mockInvite.email,
      companyName: mockInvite.company,
      role: mockInvite.role,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  const data = await apiClient.get<{
    invitationId: string;
    email: string;
    companyName: string;
    subCompanyName?: string;
    role: number;
    expiresAt: string;
  // The token is a base64-ish string that can contain "/" and "+" — inserted raw into a path
  // segment, it splits into extra segments the route doesn't match, giving a real 404 from
  // ASP.NET's own routing (not our business-logic 404) with no useful error message.
  }>(`/invites/validate/${encodeURIComponent(token)}`, undefined, { skipAuth: true });

  return { ...data, role: mapUserRoleEnum(data.role) };
}

export async function acceptInvite(token: string, password: string, confirmPassword: string): Promise<User> {
  if (API_MODE === "mock") {
    return mockAcceptInvite();
  }

  const data = await apiClient.post<TokenPairResponse>("/invites/accept", { token, password, confirmPassword }, undefined, { skipAuth: true });
  setTokens(data.accessToken, data.refreshToken);
  return userFromAccessToken(data.accessToken);
}
