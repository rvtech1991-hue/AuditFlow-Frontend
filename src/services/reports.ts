import { apiClient, ApiError, type PagedResult } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { mapTaskStatusEnum, mapTaskStatusToEnum } from "../lib/taskStatusMapping";
import { queryTasks as mockQueryTasks, type TaskStatus } from "../mock-data/tasks";
import { auditCompanies } from "../mock-data/companies";
import { auditUsers } from "../mock-data/users";
import type { Role } from "../types";

function initialsFrom(name: string): string {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Filter options — the page reuses services/companies.ts + services/users.ts
// (the same company/sub-company/assignee pickers used elsewhere in the app)
// rather than the dedicated /reports/filter-options endpoint: that endpoint's
// Assignees option has no company linkage at all (ReportCommands.cs's
// UserOption has no CompanyId/CompanyName, unlike the Tasks module's version),
// so it can't drive the cascading company -> sub-company -> assignee dropdowns
// this screen already has in mock mode. Reusing the cross-module services
// gives a strictly better (company-scoped) result in both modes.
// ---------------------------------------------------------------------------

export const reportStatusOptions: Array<{ label: string; value: Exclude<TaskStatus, "overdue"> | "all" }> = [
  { label: "All statuses", value: "all" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Reopened", value: "reopened" },
  { label: "Closed", value: "closed" },
];

export type ReportFilters = {
  // Always real ids in both modes — the company/sub-company/assignee dropdowns are backed by
  // services/companies.ts + services/users.ts, whose mock branches already use the mock
  // fixtures' real ids (not names). getTaskReport's mock branch resolves id -> name internally
  // to call the underlying mockQueryTasks(), which still expects names.
  companyId?: string;
  subCompanyId?: string;
  assigneeId?: string;
  status?: Exclude<TaskStatus, "overdue"> | "all";
  dateRange: "all" | "week" | "last30" | "quarter";
};

function resolveMockCompanyName(companyId?: string): string | undefined {
  return companyId ? auditCompanies.find((c) => c.id === companyId)?.name : undefined;
}

function resolveMockSubCompanyName(companyId?: string, subCompanyId?: string): string | undefined {
  if (!companyId || !subCompanyId) return undefined;
  return auditCompanies.find((c) => c.id === companyId)?.subCompanies.find((sc) => sc.id === subCompanyId)?.name;
}

function resolveMockAssigneeName(assigneeId?: string): string | undefined {
  return assigneeId ? auditUsers.find((u) => u.id === assigneeId)?.name : undefined;
}

export type ReportTaskRow = {
  id: string;
  taskNumber: string;
  company: string;
  subCompany: string;
  title: string;
  assignee: string;
  assigneeEmail: string;
  assigneeInitials: string;
  status: TaskStatus;
  dueDate: string;
  closedOn: string;
};

type RawReportRow = {
  id: string;
  taskNumber: string;
  companyName: string;
  subCompanyName: string;
  title: string;
  assignedToName: string;
  assignedToEmail: string;
  status: number;
  dueDate: string | null;
  closedAt: string | null;
};

function mapReportRow(raw: RawReportRow): ReportTaskRow {
  return {
    id: raw.id,
    taskNumber: raw.taskNumber,
    company: raw.companyName,
    subCompany: raw.subCompanyName,
    title: raw.title,
    assignee: raw.assignedToName,
    assigneeEmail: raw.assignedToEmail,
    assigneeInitials: initialsFrom(raw.assignedToName),
    status: mapTaskStatusEnum(raw.status),
    dueDate: raw.dueDate ? raw.dueDate.slice(0, 10) : "",
    closedOn: raw.closedAt ? raw.closedAt.slice(0, 10) : "",
  };
}

function dateRangeToDateFrom(range: ReportFilters["dateRange"]): string | undefined {
  const now = new Date();
  if (range === "week") {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  }
  if (range === "last30") {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return from.toISOString();
  }
  if (range === "quarter") {
    const from = new Date(now);
    from.setDate(from.getDate() - 90);
    return from.toISOString();
  }
  return undefined;
}

function buildReportParams(filters: ReportFilters) {
  return {
    companyId: filters.companyId || undefined,
    subCompanyId: filters.subCompanyId || undefined,
    assigneeId: filters.assigneeId || undefined,
    status: filters.status && filters.status !== "all" ? mapTaskStatusToEnum(filters.status) : undefined,
    dateFrom: dateRangeToDateFrom(filters.dateRange),
  };
}

export async function getTaskReport(role: Role, userEmail: string, filters: ReportFilters): Promise<ReportTaskRow[]> {
  if (API_MODE === "mock") {
    const rows = mockQueryTasks(role, userEmail, {
      company: resolveMockCompanyName(filters.companyId),
      subCompany: resolveMockSubCompanyName(filters.companyId, filters.subCompanyId),
      assignee: resolveMockAssigneeName(filters.assigneeId),
      status: filters.status,
      dateRange: filters.dateRange,
    });
    return rows.map((task) => ({
      id: task.id,
      taskNumber: task.id,
      company: task.company,
      subCompany: task.subCompany,
      title: task.title,
      assignee: task.assignee,
      assigneeEmail: task.assigneeEmail,
      assigneeInitials: task.assigneeInitials,
      status: task.status,
      dueDate: task.dueDate,
      closedOn: task.status === "closed" ? task.dueDate : "",
    }));
  }
  const data = await apiClient.get<PagedResult<RawReportRow>>("/reports/tasks", { ...buildReportParams(filters), pageSize: 200 });
  return data.items.map(mapReportRow);
}

// ---------------------------------------------------------------------------
// Export — sync (JSON-wrapped base64, same FileDownloadResponse pattern as the
// task template) for up to 10,000 rows; the backend 400s with EXPORT_TOO_LARGE
// above that (ReportCommandHandlers.cs), and the frontend falls back to
// queuing an async job and polling it (BACKEND_INTEGRATION_GUIDE SS8).
// ---------------------------------------------------------------------------

export type ExportResult =
  | { kind: "file"; fileName: string; contentType: string; blob: Blob }
  | { kind: "queued"; reportId: string };

function mockExportBlob(format: "excel" | "pdf", rows: ReportTaskRow[]): ExportResult {
  const header = "Task ID\tCompany\tSub-company\tTitle\tAssigned to\tStatus\tDue date";
  const body = rows.map((task) => [task.taskNumber, task.company, task.subCompany, task.title, task.assignee, task.status, task.dueDate].join("\t"));
  const content = [`TaskFlow filtered task report`, `Generated ${new Date().toLocaleString()}`, "", header, ...body].join("\n");
  const blob = new Blob([content], { type: format === "excel" ? "application/vnd.ms-excel" : "application/pdf" });
  return { kind: "file", fileName: `auditflow-report.${format === "excel" ? "xls" : "pdf"}`, contentType: blob.type, blob };
}

export async function exportTaskReport(format: "excel" | "pdf", role: Role, userEmail: string, filters: ReportFilters): Promise<ExportResult> {
  if (API_MODE === "mock") {
    return mockExportBlob(format, await getTaskReport(role, userEmail, filters));
  }
  const path = format === "excel" ? "/reports/tasks/export/excel" : "/reports/tasks/export/pdf";
  try {
    const data = await apiClient.get<{ content: string; fileName: string; contentType: string }>(path, buildReportParams(filters));
    const bytes = Uint8Array.from(atob(data.content), (char) => char.charCodeAt(0));
    return { kind: "file", fileName: data.fileName, contentType: data.contentType, blob: new Blob([bytes], { type: data.contentType }) };
  } catch (err) {
    if (err instanceof ApiError && err.errorCode === "EXPORT_TOO_LARGE") {
      const queued = await apiClient.post<{ id: string }>("/reports/tasks/export/async", { ...buildReportParams(filters), format: format === "excel" ? 1 : 2 });
      return { kind: "queued", reportId: queued.id };
    }
    throw err;
  }
}

export type ReportJobStatus = "pending" | "generating" | "completed" | "failed";
export type ReportJob = { id: string; status: ReportJobStatus; errorMessage?: string };

const JOB_STATUS_FROM_ENUM: Record<number, ReportJobStatus> = { 1: "pending", 2: "generating", 3: "completed", 4: "failed" };

export async function getReportJobStatus(reportId: string): Promise<ReportJob> {
  const data = await apiClient.get<{ id: string; status: number; errorMessage: string | null }>(`/reports/${reportId}`);
  return { id: data.id, status: JOB_STATUS_FROM_ENUM[data.status] ?? "pending", errorMessage: data.errorMessage ?? undefined };
}

export async function downloadReportFile(reportId: string): Promise<Blob> {
  return apiClient.get<Blob>(`/reports/${reportId}/download`);
}
