import { apiClient, type PagedResult } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { toEndOfDayIso, toStartOfDayIso } from "../lib/dateTime";
import { displayTaskStatus, mapTaskStatusEnum } from "../lib/taskStatusMapping";
import { companies, dashboardTasks, workload, type DashboardTask } from "../mock-data/dashboard";
import { getCompaniesForRole } from "./companies";
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
  // Plain "YYYY-MM-DD" from a date input. Both must be set to activate the "Custom" range —
  // takes over from dateRange entirely on the backend (ResolveDateWindow) when present, so the
  // caller should stop sending a preset dateRange once it sets these (DashboardPage does).
  dateFrom?: string;
  dateTo?: string;
  status?: string;
};

// tasksByPriority keys are the backend's TaskPriority enum names as strings ("Critical"/"High"/
// "Medium"/"Low") - same Dictionary<string,int> shape already used for tasksByStatus/tasksByCompany
// on this response, not a new convention.
export type ExecutiveKpis = { totalTasks: number; closureRate: number; avgTimeToClose: number; atRiskCount: number; onTimeClosureRate: number; tasksByPriority: Record<string, number> };
export type TrendPoint = { period: string; created: number; closed: number };
export type StatusMixCounts = { open: number; inProgress: number; resolved: number; closed: number; reopened: number };
export type CompanyHealth = { id: string; name: string; taskCount: number; overdueCount: number; closureRate: number };
export type TeamWorkloadEntry = { id: string; name: string; count: number };
export type AgingBucket = { bucket: "0-7" | "8-14" | "15-30" | "30+"; count: number };
export type ReviewerPerformanceEntry = { id: string; name: string; closedCount: number; avgTurnaroundDays: number };

export type DashboardCompanyOption = { id: string; name: string };
export type DashboardSubCompanyOption = { id: string; name: string; companyId: string };
export type DashboardCompanyScope = { companies: DashboardCompanyOption[]; subCompanies: DashboardSubCompanyOption[] };

// The executive dashboard's Company filter needs the list of companies the caller actually has
// *task data* access to — not `/companies` (services/companies.ts), which for an Auditor
// deliberately lists every company in the tenant (so they can browse/manage ones they aren't
// yet individually mapped to via UserCompanyMapping). Picking one of those un-mapped companies
// here used to silently fall back to the caller's real scope instead of the selection, which
// looked like "the filter does nothing." `/tasks/filter-options` is already scoped correctly
// (same access boundary the task grid's own company filter uses), so this reuses it instead of
// duplicating that scoping logic.
export async function getDashboardCompanyScope(role: Role): Promise<DashboardCompanyScope> {
  if (API_MODE === "mock") {
    const entries = await getCompaniesForRole(role);
    return {
      companies: entries.map((c) => ({ id: c.id, name: c.name })),
      subCompanies: entries.flatMap((c) => c.subCompanies.map((sc) => ({ id: sc.id, name: sc.name, companyId: c.id }))),
    };
  }
  const data = await apiClient.get<{
    companies: Array<{ id: string; name: string }>;
    subCompanies: Array<{ id: string; name: string; companyId: string }>;
  }>("/tasks/filter-options");
  return { companies: data.companies, subCompanies: data.subCompanies };
}

function scopedMockTasks(role: Role, companyName?: string): DashboardTask[] {
  if (companyName) return dashboardTasks.filter((t) => t.company === companyName);
  if (role === "Company admin") return dashboardTasks.filter((t) => t.company === companies[0].name);
  return dashboardTasks;
}

function scopedMockCompanies(role: Role, companyName?: string) {
  if (companyName) return companies.filter((c) => c.name === companyName);
  return role === "Company admin" ? companies.slice(0, 1) : companies;
}

// "all"/undefined means no filter; every other value narrows the scoped task set to that one
// status before the caller derives counts/rates from it.
function applyMockStatusFilter(tasks: DashboardTask[], status?: string): DashboardTask[] {
  if (!status || status === "all") return tasks;
  return tasks.filter((t) => t.status === status);
}

export async function getExecutiveKpis(role: Role, filters: ExecutiveFilters): Promise<ExecutiveKpis> {
  if (API_MODE === "mock") {
    const scoped = applyMockStatusFilter(scopedMockTasks(role, filters.companyName), filters.status);
    const closed = scoped.filter((t) => t.status === "closed").length;
    const totalTasks = scoped.length;
    const closureRate = totalTasks ? Math.round((closed / totalTasks) * 100) : 0;
    const atRiskCount = scoped.filter((t) => t.status === "overdue").length;
    // Mock task fixtures don't carry a priority field (see mock-data/dashboard.ts) - illustrative
    // fixed split rather than derived, same treatment as the hardcoded avgTimeToClose below.
    return {
      totalTasks,
      closureRate,
      avgTimeToClose: 5.8,
      atRiskCount,
      onTimeClosureRate: 84,
      tasksByPriority: { Critical: Math.round(totalTasks * 0.08), High: Math.round(totalTasks * 0.27), Medium: Math.round(totalTasks * 0.42), Low: Math.round(totalTasks * 0.23) },
    };
  }
  return apiClient.get<ExecutiveKpis>("/dashboard/executive/kpis", {
    companyId: filters.companyId,
    subCompanyId: filters.subCompanyId,
    dateRange: filters.dateRange,
    dateFrom: filters.dateFrom ? toStartOfDayIso(filters.dateFrom) : undefined,
    dateTo: filters.dateTo ? toEndOfDayIso(filters.dateTo) : undefined,
    status: filters.status,
  });
}

export async function getExecutiveTrend(role: Role, filters: ExecutiveFilters): Promise<TrendPoint[]> {
  if (API_MODE === "mock") return [];
  return apiClient.get<TrendPoint[]>("/dashboard/executive/trend", {
    companyId: filters.companyId,
    subCompanyId: filters.subCompanyId,
    dateRange: filters.dateRange,
    dateFrom: filters.dateFrom ? toStartOfDayIso(filters.dateFrom) : undefined,
    dateTo: filters.dateTo ? toEndOfDayIso(filters.dateTo) : undefined,
    status: filters.status,
  });
}

export async function getExecutiveStatusMix(role: Role, filters: ExecutiveFilters): Promise<StatusMixCounts> {
  if (API_MODE === "mock") {
    const scoped = applyMockStatusFilter(scopedMockTasks(role, filters.companyName), filters.status);
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
  const data = await apiClient.get<{ statusCounts: Record<string, number> }>("/dashboard/executive/status-mix", {
    companyId: filters.companyId,
    subCompanyId: filters.subCompanyId,
    dateRange: filters.dateRange,
    dateFrom: filters.dateFrom ? toStartOfDayIso(filters.dateFrom) : undefined,
    dateTo: filters.dateTo ? toEndOfDayIso(filters.dateTo) : undefined,
    status: filters.status,
  });
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

// "At risk" here (overdue OR due within 7 days) must stay in lockstep with the At-risk KPI card's
// own definition (getExecutiveKpis' atRiskCount = overdueTasks + dueSoonTasks) - this used to only
// look at dueInDays < 0 (overdue only), which is why the KPI could say "5 at risk" while this list
// showed a single overdue row underneath it.
export async function getExecutiveRiskTasks(role: Role, filters: ExecutiveFilters): Promise<DashboardTask[]> {
  if (API_MODE === "mock") {
    const atRisk = applyMockStatusFilter(scopedMockTasks(role, filters.companyName), filters.status).filter((t) => t.dueInDays <= 7 && t.status !== "closed" && t.status !== "resolved");
    return atRisk.sort((a, b) => a.dueInDays - b.dueInDays).slice(0, 5);
  }
  const data = await apiClient.get<RawTaskListItem[]>("/dashboard/executive/risk-tasks", {
    companyId: filters.companyId,
    subCompanyId: filters.subCompanyId,
    dateRange: filters.dateRange,
    dateFrom: filters.dateFrom ? toStartOfDayIso(filters.dateFrom) : undefined,
    dateTo: filters.dateTo ? toEndOfDayIso(filters.dateTo) : undefined,
    status: filters.status,
    limit: 5,
  });
  return data.map(mapTaskListItem);
}

export async function getExecutiveTeamWorkload(role: Role, filters: ExecutiveFilters): Promise<TeamWorkloadEntry[]> {
  if (API_MODE === "mock") {
    return workload.map((w) => ({ id: w.name, name: w.name, count: w.count }));
  }
  const data = await apiClient.get<Array<{ userId: string; userName: string; totalAssigned: number }>>("/dashboard/executive/team-workload", { companyId: filters.companyId, subCompanyId: filters.subCompanyId });
  return data.map((w) => ({ id: w.userId, name: w.userName, count: w.totalAssigned }));
}

export async function getExecutiveAging(role: Role, filters: ExecutiveFilters): Promise<AgingBucket[]> {
  if (API_MODE === "mock") {
    const overdue = scopedMockTasks(role, filters.companyName).filter((t) => t.status === "overdue");
    const bucketFor = (daysOverdue: number): AgingBucket["bucket"] => (daysOverdue <= 7 ? "0-7" : daysOverdue <= 14 ? "8-14" : daysOverdue <= 30 ? "15-30" : "30+");
    const counts: Record<AgingBucket["bucket"], number> = { "0-7": 0, "8-14": 0, "15-30": 0, "30+": 0 };
    overdue.forEach((t) => { counts[bucketFor(Math.abs(t.dueInDays))] += 1; });
    return (["0-7", "8-14", "15-30", "30+"] as const).map((bucket) => ({ bucket, count: counts[bucket] }));
  }
  const data = await apiClient.get<Array<{ bucket: AgingBucket["bucket"]; count: number }>>("/dashboard/executive/aging", { companyId: filters.companyId, subCompanyId: filters.subCompanyId });
  return data;
}

export async function getExecutiveReviewerPerformance(role: Role, filters: ExecutiveFilters): Promise<ReviewerPerformanceEntry[]> {
  if (API_MODE === "mock") {
    // Mock fixtures have no ClosedBy/turnaround data (see mock-data/dashboard.ts) - reuses the
    // same named reviewers as the workload widget with illustrative counts, same treatment as
    // the other hardcoded mock executive figures above.
    return workload.map((w, index) => ({ id: w.name, name: w.name, closedCount: Math.max(4, w.count * 3 - index * 2), avgTurnaroundDays: Math.round((3.2 + index * 0.9) * 10) / 10 }));
  }
  const data = await apiClient.get<Array<{ userId: string; userName: string; closedCount: number; avgTurnaroundDays: number }>>("/dashboard/executive/reviewer-performance", { companyId: filters.companyId, subCompanyId: filters.subCompanyId, dateRange: filters.dateRange, dateFrom: filters.dateFrom ? toStartOfDayIso(filters.dateFrom) : undefined, dateTo: filters.dateTo ? toEndOfDayIso(filters.dateTo) : undefined });
  return data.map((r) => ({ id: r.userId, name: r.userName, closedCount: r.closedCount, avgTurnaroundDays: r.avgTurnaroundDays }));
}
