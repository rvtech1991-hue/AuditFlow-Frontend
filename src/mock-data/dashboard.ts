import type { Status } from "../types";

export type DashboardTask = {
  id: string;
  title: string;
  company: string;
  subCompany: string;
  assignee: string;
  assigneeInitials: string;
  status: Extract<Status, "open" | "progress" | "overdue" | "closed">;
  dueInDays: number;
};

export const dashboardTasks: DashboardTask[] = [
  { id: "AF-1024", title: "Bank reconciliation mismatch", company: "Meridian Group", subCompany: "North Finance", assignee: "Nisha Rao", assigneeInitials: "NR", status: "progress", dueInDays: 2 },
  { id: "AF-1025", title: "GST input credit evidence missing", company: "Meridian Group", subCompany: "South Plant", assignee: "Dev Mehta", assigneeInitials: "DM", status: "overdue", dueInDays: -4 },
  { id: "AF-1026", title: "Payroll approval trail incomplete", company: "Kestrel Logistics", subCompany: "Depot East", assignee: "Anika Shah", assigneeInitials: "AS", status: "closed", dueInDays: 0 },
  { id: "AF-1027", title: "Vendor onboarding checklist gap", company: "Patel & Co.", subCompany: "Shared Services", assignee: "Rahul Iyer", assigneeInitials: "RI", status: "open", dueInDays: 6 },
  { id: "AF-1028", title: "Missing fixed asset verification", company: "Kestrel Logistics", subCompany: "Depot West", assignee: "J. Tan", assigneeInitials: "JT", status: "overdue", dueInDays: -8 },
  { id: "AF-1029", title: "Expense policy exception not approved", company: "Meridian Group", subCompany: "Corporate", assignee: "A. Verma", assigneeInitials: "AV", status: "progress", dueInDays: 3 },
];

export const companies = [
  { name: "Meridian Group", subCompanies: ["Corporate", "North Finance", "South Plant"], open: 18, overdue: 4, closureRate: 72 },
  { name: "Kestrel Logistics", subCompanies: ["Depot East", "Depot West"], open: 13, overdue: 5, closureRate: 64 },
  { name: "Patel & Co.", subCompanies: ["Shared Services", "Retail Audit"], open: 9, overdue: 1, closureRate: 84 },
];

export const workload = [
  { name: "Nisha Rao", count: 12 },
  { name: "Dev Mehta", count: 9 },
  { name: "Anika Shah", count: 7 },
  { name: "Rahul Iyer", count: 5 },
  { name: "J. Tan", count: 4 },
];

export const trendDeltas = {
  overdue: "+12% vs last week",
  open: "-8% vs last week",
  progress: "+5% moving",
  closed: "+18% this week",
};
