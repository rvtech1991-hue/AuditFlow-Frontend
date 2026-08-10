import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as authService from "../services/auth";
import { API_MODE } from "./config";
import { setUnauthorizedHandler } from "./apiClient";
import { getAccessToken } from "./tokenStorage";
import { decodeAccessToken } from "./jwt";
import { mapBackendRole } from "./roleMapping";
import { queryClient } from "./queryClient";
import { connectNotificationHub, disconnectNotificationHub } from "./notificationHub";
import { mockUser } from "../mock-data/auth";
import type { Role, User } from "../types";

type RoleContextValue = {
  user: User;
  role: Role;
  isAuthenticated: boolean;
  /** Mock-mode-only demo role switcher (Topbar) — no-op in live mode, where role comes from the JWT. */
  setRole: (role: Role) => void;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  acceptInvite: (token: string, password: string, confirmPassword: string) => Promise<void>;
  signOut: () => void;
};

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

const roleProfiles: Record<Role, Pick<User, "name" | "email">> = {
  "Platform admin": { name: "Platform Admin", email: "platform@auditflow.test" },
  Auditor: { name: "Rakesh Kumar", email: "rakesh@auditflow.test" },
  "Company admin": { name: "Kavita Patel", email: "company.admin@meridian.com" },
  Employee: { name: "A. Verma", email: "a.verma@meridian.com" },
};

function restoreMockUser(): User {
  const role = (window.localStorage.getItem("auditflow-role") as Role | null) ?? mockUser.role;
  const email = window.localStorage.getItem("auditflow-email") ?? mockUser.email;
  const name = window.localStorage.getItem("auditflow-name") ?? mockUser.name;
  return { ...mockUser, role, email, name };
}

function restoreLiveUser(): User | null {
  const accessToken = getAccessToken();
  if (!accessToken) return null;
  try {
    const claims = decodeAccessToken(accessToken);
    return {
      id: claims.userId,
      name: claims.fullName,
      email: claims.email,
      role: mapBackendRole(claims.role),
      status: "Active",
      tenantId: claims.tenantId,
      companyId: claims.companyId,
      subCompanyId: claims.subCompanyId,
    };
  } catch {
    return null;
  }
}

function initialAuthState(): { isAuthenticated: boolean; user: User | null } {
  if (API_MODE === "mock") {
    const isAuthenticated = window.localStorage.getItem("auditflow-auth") === "true";
    return { isAuthenticated, user: isAuthenticated ? restoreMockUser() : null };
  }
  const user = restoreLiveUser();
  return { isAuthenticated: user !== null, user };
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [{ isAuthenticated, user }, setAuthState] = useState(initialAuthState);

  // Registered once so apiClient can force a sign-out when a refresh attempt itself fails,
  // without importing this context directly (avoids a circular dependency).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthState({ isAuthenticated: false, user: null });
      queryClient.clear();
    });
  }, []);

  // Live real-time notifications ride the same auth session as the REST API — connect once
  // logged in, tear down on logout so a stale connection doesn't leak across users.
  useEffect(() => {
    if (API_MODE !== "live") return;
    if (isAuthenticated) {
      connectNotificationHub();
    } else {
      disconnectNotificationHub();
    }
    return () => disconnectNotificationHub();
  }, [isAuthenticated]);

  const setRole = (nextRole: Role) => {
    if (API_MODE !== "mock") return;
    const profile = roleProfiles[nextRole];
    const nextUser: User = { ...mockUser, role: nextRole, email: profile.email, name: profile.name };
    setAuthState({ isAuthenticated: true, user: nextUser });
    window.localStorage.setItem("auditflow-role", nextRole);
    window.localStorage.setItem("auditflow-email", profile.email);
    window.localStorage.setItem("auditflow-name", profile.name);
  };

  const signIn = async (email: string, password: string, rememberMe?: boolean) => {
    const nextUser = await authService.login(email, password, rememberMe);
    setAuthState({ isAuthenticated: true, user: nextUser });
    if (API_MODE === "mock") {
      window.localStorage.setItem("auditflow-auth", "true");
      window.localStorage.setItem("auditflow-role", nextUser.role);
      window.localStorage.setItem("auditflow-email", nextUser.email);
      window.localStorage.setItem("auditflow-name", nextUser.name);
    }
  };

  const acceptInvite = async (token: string, password: string, confirmPassword: string) => {
    const nextUser = await authService.acceptInvite(token, password, confirmPassword);
    setAuthState({ isAuthenticated: true, user: nextUser });
    if (API_MODE === "mock") {
      window.localStorage.setItem("auditflow-auth", "true");
      window.localStorage.setItem("auditflow-role", nextUser.role);
      window.localStorage.setItem("auditflow-email", nextUser.email);
      window.localStorage.setItem("auditflow-name", nextUser.name);
    }
  };

  const signOut = () => {
    setAuthState({ isAuthenticated: false, user: null });
    queryClient.clear();
    if (API_MODE === "mock") {
      window.localStorage.removeItem("auditflow-auth");
    } else {
      void authService.logout();
    }
  };

  const value = useMemo<RoleContextValue>(
    () => ({
      user: user ?? mockUser,
      role: (user ?? mockUser).role,
      isAuthenticated,
      setRole,
      signIn,
      acceptInvite,
      signOut,
    }),
    [user, isAuthenticated],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used inside RoleProvider");
  }
  return context;
}
