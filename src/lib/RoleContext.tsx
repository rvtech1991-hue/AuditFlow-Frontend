import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { mockUser } from "../mock-data/auth";
import type { Role, User } from "../types";

type RoleContextValue = {
  user: User;
  role: Role;
  isAuthenticated: boolean;
  setRole: (role: Role) => void;
  signIn: (email: string) => void;
  acceptInvite: (email: string, role: Role) => void;
  signOut: () => void;
};

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

const roleProfiles: Record<Role, Pick<User, "name" | "email">> = {
  "Platform admin": { name: "Platform Admin", email: "platform@auditflow.test" },
  Auditor: { name: "Rakesh Kumar", email: "rakesh@auditflow.test" },
  "Company admin": { name: "Kavita Patel", email: "company.admin@meridian.com" },
  Employee: { name: "A. Verma", email: "a.verma@meridian.com" },
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

export function RoleProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => window.localStorage.getItem("auditflow-auth") === "true");
  const [role, setRoleState] = useState<Role>(() => (window.localStorage.getItem("auditflow-role") as Role | null) ?? mockUser.role);
  const [email, setEmail] = useState(() => window.localStorage.getItem("auditflow-email") ?? mockUser.email);
  const [name, setName] = useState(() => window.localStorage.getItem("auditflow-name") ?? mockUser.name);
  const user = useMemo(() => ({ ...mockUser, email, name, role }), [email, name, role]);

  const setRole = (nextRole: Role) => {
    const profile = roleProfiles[nextRole];
    setRoleState(nextRole);
    setEmail(profile.email);
    setName(profile.name);
    window.localStorage.setItem("auditflow-role", nextRole);
    window.localStorage.setItem("auditflow-email", profile.email);
    window.localStorage.setItem("auditflow-name", profile.name);
  };

  const signIn = (nextEmail: string) => {
    const nextRole = roleFromEmail(nextEmail);
    const nextName = nameFromEmail(nextEmail);
    setEmail(nextEmail);
    setName(nextName);
    setRoleState(nextRole);
    setIsAuthenticated(true);
    window.localStorage.setItem("auditflow-auth", "true");
    window.localStorage.setItem("auditflow-role", nextRole);
    window.localStorage.setItem("auditflow-email", nextEmail);
    window.localStorage.setItem("auditflow-name", nextName);
  };

  const acceptInvite = (nextEmail: string, nextRole: Role) => {
    const nextName = nameFromEmail(nextEmail);
    setEmail(nextEmail);
    setName(nextName);
    setRoleState(nextRole);
    setIsAuthenticated(true);
    window.localStorage.setItem("auditflow-auth", "true");
    window.localStorage.setItem("auditflow-role", nextRole);
    window.localStorage.setItem("auditflow-email", nextEmail);
    window.localStorage.setItem("auditflow-name", nextName);
  };

  const signOut = () => {
    setIsAuthenticated(false);
    window.localStorage.removeItem("auditflow-auth");
  };

  return <RoleContext.Provider value={{ user, role, isAuthenticated, setRole, signIn, acceptInvite, signOut }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used inside RoleProvider");
  }
  return context;
}
