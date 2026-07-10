import type { User } from "../types";

export const mockUser: User = {
  name: "Rakesh Kumar",
  email: "rakesh@auditflow.test",
  role: "Auditor",
  status: "Active",
};

export const mockInvite = {
  company: "Meridian Group",
  role: "Employee" as const,
  inviterName: "R. Sharma",
  inviterEmail: "a.verma@meridian.com",
  email: "a.verma@meridian.com",
};
