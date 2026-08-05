import { apiClient, type PagedResult } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { displayTaskStatus, mapTaskStatusEnum } from "../lib/taskStatusMapping";
import { companies, dashboardTasks, workload, type DashboardTask } from "../mock-data/dashboard";
import type { Role } from "../types";

export type DashboardSummary = {
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completedThisWeek: number;
};

export type StatusBreakdown = {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  overdue: number;
  total: number;
};

export type DashboardAnnouncement = {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
};

// Field names match the backend's DashboardSummaryResponse / TaskListItemResponse /
// StatusBreakdownResponse / AnnouncementListItemResponse DTOs (verified directly against
// AuditFlow-Backend/src/AuditFlow.Application, not guessed) — see SS8 of the integration guide.
type RawDashboardSummary = {
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completedThisWeek: number;
};

type RawTaskListItem = {
  id: string;
  taskNumber: string;
  title: string;
  companyName: string;
  subCompanyName: string;
  assignedToName: string;
  status: number;
  dueDate: string | null;
  isOverdue: boolean;
};

type RawStatusBreakdown = {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  overdue: number;
  total: number;
};

type RawAnnouncement = {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
};

function initialsFrom(name: string): string {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function mapTaskListItem(raw: RawTaskListItem): DashboardTask {
  const dueInDays = raw.dueDate ? Math.ceil((new Date(raw.dueDate).getTime() - Date.now()) / 86_400_000) : 0;
  const realStatus = mapTaskStatusEnum(raw.status);
  return {
    id: raw.id,
    taskNumber: raw.taskNumber,
    title: raw.title,
    company: raw.companyName,
    subCompany: raw.subCompanyName,
    assignee: raw.assignedToName,
    assigneeInitials: initialsFrom(raw.assignedToName),
    status: displayTaskStatus(realStatus, raw.isOverdue),
    dueInDays,
  };
}

export async function getSummary(): Promise<DashboardSummary> {
  if (API_MODE === "mock") {
    const totals = dashboardTasks.reduce(
      (acc, task) => {
        if (task.status === "open") acc.openTasks += 1;
        else if (task.status === "progress") acc.inProgressTasks += 1;
        else if (task.status === "overdue") acc.overdueTasks += 1;
        else if (task.status === "closed") acc.completedThisWeek += 1;
        return acc;
      },
      { totalTasks: dashboardTasks.length, openTasks: 0, inProgressTasks: 0, overdueTasks: 0, completedThisWeek: 0 },
    );
    return totals;
  }
  return apiClient.get<RawDashboardSummary>("/dashboard/summary");
}

export async function getWeeklyTasks(): Promise<DashboardTask[]> {
  if (API_MODE === "mock") {
    return dashboardTasks.slice(0, 5);
  }
  const data = await apiClient.get<PagedResult<RawTaskListItem>>("/dashboard/weekly-tasks", { pageSize: 5 });
  return data.items.map(mapTaskListItem);
}

export async function getStatusBreakdown(): Promise<StatusBreakdown> {
  if (API_MODE === "mock") {
    const totals = dashboardTasks.reduce(
      (acc, task) => {
        if (task.status === "open") acc.open += 1;
        else if (task.status === "progress") acc.inProgress += 1;
        else if (task.status === "resolved") acc.resolved += 1;
        else if (task.status === "overdue") acc.overdue += 1;
        else if (task.status === "closed") acc.closed += 1;
        acc.total += 1;
        return acc;
      },
      { open: 0, inProgress: 0, resolved: 0, closed: 0, overdue: 0, total: 0 },
    );
    return totals;
  }
  const data = await apiClient.get<RawStatusBreakdown>("/dashboard/status-breakdown");
  return data;
}

export async function getAnnouncements(): Promise<DashboardAnnouncement[]> {
  if (API_MODE === "mock") {
    return [{ id: "mock-announcement", title: "Quarter-close evidence deadline is Friday.", content: "Auditor broadcasts appear here for everyone in scope.", isPinned: true }];
  }
  const data = await apiClient.get<RawAnnouncement[]>("/dashboard/announcements");
  return data;
}

// ---------------------------------------------------------------------------
// Executive dashboard — field names verified directly against the backend
// source (DashboardDtos.cs, DashboardQueries.cs, DashboardExecutiveQueryHandlers.cs,
// DashboardRepository.cs — the StatusMix dictionary keys are C#
// AuditTaskStatus.ToString() values, confirmed in the repository implementation)
// rather than guessed — see BACKEND_INTEGRATION_GUIDE SS8.
// ---------------------------------------------------------------------------

export type ExecutiveFilters = {
  companyId?: string;
  // Mock mode has no real company ids of its own (a different, name-only fixture from the
  // live company list) — the caller resolves the selected company's display name once and
  // passes it here so the mock branch can filter its own fixtures without cross-file lookups.
  companyName?: string;
  subCompanyId?: string;
  dateRange?: string;
};

export type ExecutiveKpis = { totalTasks: number; closureRate: number; avgTimeToClose: number; atRiskCount: number };
export type TrendPoint = { period: string; created: number; closed: number };
export type StatusMixCounts = { open: number; inProgress: number; resolved: number; closed: number; reopened: number };
export type CompanyHealth = { id: string; name: string; taskCount: number; overdueCount: number; closureRate: number };
export type TeamWorkloadEntry = { id: string; name: string; count: number };

function scopedMockTasks(role: Role, companyName?: string): DashboardTask[] {
  if (companyName) return dashboardTasks.filter((t) => t.company === companyName);
  if (role === "Company admin") return dashboardTasks.filter((t) => t.company === companies[0].name);
  return dashboardTasks;
}

function scopedMockCompanies(role: Role, companyName?: string) {
  if (companyName) return companies.filter((c) => c.name === companyName);
  return role === "Company admin" ? companies.slice(0, 1) : companies;
}

export async function getExecutiveKpis(role: Role, filters: ExecutiveFilters): Promise<ExecutiveKpis> {
  if (API_MODE === "mock") {
    const scoped = scopedMockTasks(role, filters.companyName);
    const closed = scoped.filter((t) => t.status === "closed").length;
    const totalTasks = scoped.length;
    const closureRate = totalTasks ? Math.round((closed / totalTasks) * 100) : 0;
    const atRiskCount = scoped.filter((t) => t.status === "overdue").length;
    return { totalTasks, closureRate, avgTimeToClose: 5.8, atRiskCount };
  }
  return apiClient.get<ExecutiveKpis>("/dashboard/executive/kpis", { companyId: filters.companyId, subCompanyId: filters.subCompanyId, dateRange: filters.dateRange });
}

export async function getExecutiveTrend(role: Role, filters: ExecutiveFilters): Promise<TrendPoint[]> {
  if (API_MODE === "mock") return [];
  return apiClient.get<TrendPoint[]>("/dashboard/executive/trend", { companyId: filters.companyId, subCompanyId: filters.subCompanyId, dateRange: filters.dateRange });
}

export async function getExecutiveStatusMix(role: Role, filters: ExecutiveFilters): Promise<StatusMixCounts> {
  if (API_MODE === "mock") {
    const scoped = scopedMockTasks(role, filters.companyName);
    return scoped.reduce(
      (acc, t) => {
        // The mock fixture's "overdue" is a pseudo-status (SS7) with no distinct real-status
        // recorded — folded into "open" here as the closest reasonable approximation.
        if (t.status === "open" || t.status === "overdue") acc.open += 1;
        else if (t.status === "progress") acc.inProgress += 1;
        else if (t.status === "resolved") acc.resolved += 1;
        else if (t.status === "closed") acc.closed += 1;
        else if (t.status === "reopened") acc.reopened += 1;
        return acc;
      },
      { open: 0, inProgress: 0, resolved: 0, closed: 0, reopened: 0 },
    );
  }
  const data = await apiClient.get<{ statusCounts: Record<string, number> }>("/dashboard/executive/status-mix", { companyId: filters.companyId, subCompanyId: filters.subCompanyId, dateRange: filters.dateRange });
  const counts = data.statusCounts;
  return { open: counts.Open ?? 0, inProgress: counts.InProgress ?? 0, resolved: counts.Resolved ?? 0, closed: counts.Closed ?? 0, reopened: counts.Reopened ?? 0 };
}

export async function getExecutiveCompanyHealth(role: Role, filters: ExecutiveFilters): Promise<CompanyHealth[]> {
  if (API_MODE === "mock") {
    return scopedMockCompanies(role, filters.companyName).map((c) => ({ id: c.name, name: c.name, taskCount: c.open, overdueCount: c.overdue, closureRate: c.closureRate }));
  }
  const data = await apiClient.get<Array<{ companyId: string; companyName: string; taskCount: number; overdueCount: number; closureRate: number }>>("/dashboard/executive/company-health", {
    companyId: filters.companyId,
    subCompanyId: filters.subCompanyId,
    dateRange: filters.dateRange,
  });
  return data.map((c) => ({ id: c.companyId, name: c.companyName, taskCount: c.taskCount, overdueCount: c.overdueCount, closureRate: c.closureRate }));
}

export async function getExecutiveRiskTasks(role: Role, filters: ExecutiveFilters): Promise<DashboardTask[]> {
  if (API_MODE === "mock") {
    return [...scopedMockTasks(role, filters.companyName)].filter((t) => t.dueInDays < 0).sort((a, b) => a.dueInDays - b.dueInDays).slice(0, 4);
  }
  const data = await apiClient.get<RawTaskListItem[]>("/dashboard/executive/risk-tasks", { companyId: filters.companyId, subCompanyId: filters.subCompanyId, limit: 4 });
  return data.map(mapTaskListItem);
}

export async function getExecutiveTeamWorkload(role: Role, filters: ExecutiveFilters): Promise<TeamWorkloadEntry[]> {
  if (API_MODE === "mock") {
    return workload.map((w) => ({ id: w.name, name: w.name, count: w.count }));
  }
  const data = await apiClient.get<Array<{ userId: string; userName: string; totalAssigned: number }>>("/dashboard/executive/team-workload", { companyId: filters.companyId, subCompanyId: filters.subCompanyId });
  return data.map((w) => ({ id: w.userId, name: w.userName, count: w.totalAssigned }));
}
