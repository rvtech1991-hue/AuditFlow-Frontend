import { apiClient } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { mapUserRoleEnum } from "../lib/roleMapping";
import { mapTaskStatusEnum, displayTaskStatus } from "../lib/taskStatusMapping";
import {
  mapChecklistRecurrenceEnum,
  mapChecklistRecurrenceToEnum,
  mapChecklistItemStatusEnum,
  mapChecklistItemStatusToEnum,
  type ChecklistRecurrence,
  type ChecklistItemStatus,
} from "../lib/checklistMapping";
import {
  createMockChecklistItem,
  deleteMockChecklistItem,
  getMockChecklistItems,
  getMockTeamChecklist,
  getMockTeamMemberChecklist,
  updateMockChecklistItem,
  updateMockChecklistItemStatus,
} from "../mock-data/checklist";
import { auditTasks } from "../mock-data/tasks";
import type { Role } from "../types";

export type { ChecklistRecurrence, ChecklistItemStatus };

export type ChecklistFeedItem = {
  id: string;
  source: "Personal" | "AuditTask";
  title: string;
  description: string;
  recurrence: ChecklistRecurrence | null;
  dueDate: string; // ISO
  /** ChecklistItemStatus value for Personal rows, TaskStatus display value (already
   * overdue-adjusted) for AuditTask rows — the page renders each source's own label set. */
  status: string;
  isOverdue: boolean;
  completedAt: string | null;
  taskId?: string;
  taskNumber?: string;
  assignedByName?: string;
};

export type MyChecklist = {
  todayCount: number;
  completedTodayCount: number;
  overdueCount: number;
  weekCompletionRatePercent: number;
  items: ChecklistFeedItem[];
};

export type TeamChecklistRow = {
  userId: string;
  fullName: string;
  role: Role;
  todayCount: number;
  completedTodayCount: number;
  overdueCount: number;
  weekCompletionRatePercent: number;
  lastUpdateAt: string | null;
};

type RawChecklistFeedItem = {
  id: string;
  source: "Personal" | "AuditTask";
  title: string;
  description: string | null;
  recurrenceType: number | null;
  dueDate: string;
  status: number;
  isOverdue: boolean;
  completedAt: string | null;
  taskId: string | null;
  taskNumber: string | null;
  assignedByName: string | null;
};

function mapFeedItem(raw: RawChecklistFeedItem): ChecklistFeedItem {
  const status = raw.source === "AuditTask"
    ? displayTaskStatus(mapTaskStatusEnum(raw.status), raw.isOverdue)
    : mapChecklistItemStatusEnum(raw.status);

  return {
    id: raw.id,
    source: raw.source,
    title: raw.title,
    description: raw.description ?? "",
    recurrence: raw.recurrenceType != null ? mapChecklistRecurrenceEnum(raw.recurrenceType) : null,
    dueDate: raw.dueDate,
    status,
    isOverdue: raw.isOverdue,
    completedAt: raw.completedAt,
    taskId: raw.taskId ?? undefined,
    taskNumber: raw.taskNumber ?? undefined,
    assignedByName: raw.assignedByName ?? undefined,
  };
}

function mockAssignedTaskItems(userEmail: string): ChecklistFeedItem[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  return auditTasks
    .filter((task) => task.assigneeEmail.toLowerCase() === userEmail.toLowerCase())
    .filter((task) => task.status !== "closed" || new Date(`${task.dueDate}T00:00:00`) >= cutoff)
    .map((task) => ({
      id: task.id,
      source: "AuditTask" as const,
      title: task.title,
      description: task.description,
      recurrence: null,
      dueDate: `${task.dueDate}T17:00:00`,
      status: displayTaskStatus(task.status === "overdue" ? "open" : task.status, task.status !== "closed" && task.status !== "resolved" && new Date(`${task.dueDate}T23:59:59`) < new Date()),
      isOverdue: task.status !== "closed" && task.status !== "resolved" && new Date(`${task.dueDate}T23:59:59`) < new Date(),
      completedAt: task.status === "closed" ? `${task.dueDate}T17:00:00` : null,
      taskId: task.id,
      taskNumber: task.id,
      assignedByName: task.createdBy,
    }));
}

function computeStats(items: ChecklistFeedItem[]): Omit<MyChecklist, "items"> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const isDone = (item: ChecklistFeedItem) => item.status === "Completed" || item.status === "closed";
  const inRange = (item: ChecklistFeedItem, start: Date, end: Date) => {
    const due = new Date(item.dueDate);
    return due >= start && due < end;
  };

  const todayItems = items.filter((i) => inRange(i, todayStart, todayEnd));
  const weekItems = items.filter((i) => inRange(i, weekStart, todayEnd));
  const weekCompleted = weekItems.filter(isDone).length;

  return {
    todayCount: todayItems.length,
    completedTodayCount: todayItems.filter(isDone).length,
    overdueCount: items.filter((i) => i.isOverdue).length,
    weekCompletionRatePercent: weekItems.length === 0 ? 0 : Math.round((100 * weekCompleted) / weekItems.length),
  };
}

export async function getMyChecklist(userEmail: string, fromUtc?: string, toUtc?: string): Promise<MyChecklist> {
  if (API_MODE === "mock") {
    const personal: ChecklistFeedItem[] = getMockChecklistItems().map((c) => ({
      id: c.id,
      source: "Personal",
      title: c.title,
      description: c.description,
      recurrence: c.recurrenceType,
      dueDate: c.dueDate,
      status: c.status,
      isOverdue: c.status !== "Completed" && new Date(c.dueDate) < new Date(),
      completedAt: c.completedAt,
    }));
    const items = [...personal, ...mockAssignedTaskItems(userEmail)].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return { ...computeStats(items), items };
  }

  const raw = await apiClient.get<{
    todayCount: number;
    completedTodayCount: number;
    overdueCount: number;
    weekCompletionRatePercent: number;
    items: RawChecklistFeedItem[];
  }>("/checklist", { fromUtc, toUtc });

  return {
    todayCount: raw.todayCount,
    completedTodayCount: raw.completedTodayCount,
    overdueCount: raw.overdueCount,
    weekCompletionRatePercent: raw.weekCompletionRatePercent,
    items: raw.items.map(mapFeedItem),
  };
}

export async function getTeamChecklist(fromUtc?: string, toUtc?: string): Promise<TeamChecklistRow[]> {
  if (API_MODE === "mock") {
    return getMockTeamChecklist().map((r) => ({
      userId: r.userId,
      fullName: r.fullName,
      role: r.role as Role,
      todayCount: r.todayCount,
      completedTodayCount: r.completedTodayCount,
      overdueCount: r.overdueCount,
      weekCompletionRatePercent: r.weekCompletionRatePercent,
      lastUpdateAt: r.lastUpdateAt,
    }));
  }

  const raw = await apiClient.get<{
    rows: Array<{
      userId: string; fullName: string; role: number; todayCount: number; completedTodayCount: number;
      overdueCount: number; weekCompletionRatePercent: number; lastUpdateAt: string | null;
    }>;
  }>("/checklist/team", { fromUtc, toUtc });

  return raw.rows.map((r) => ({
    userId: r.userId,
    fullName: r.fullName,
    role: mapUserRoleEnum(r.role),
    todayCount: r.todayCount,
    completedTodayCount: r.completedTodayCount,
    overdueCount: r.overdueCount,
    weekCompletionRatePercent: r.weekCompletionRatePercent,
    lastUpdateAt: r.lastUpdateAt,
  }));
}

export type TeamMemberChecklist = MyChecklist & { userId: string; fullName: string; role: Role };

/** Drill-down behind a Team Activity row — that one person's full merged feed, read-only from
 * the viewer's side (Personal items still can't be edited/deleted here; AuditTask rows still
 * deep-link to Task Details). Auditor/Company admin only, enforced server-side. */
export async function getTeamMemberChecklist(userId: string, fromUtc?: string, toUtc?: string): Promise<TeamMemberChecklist> {
  if (API_MODE === "mock") {
    const row = getMockTeamChecklist().find((r) => r.userId === userId);
    const items: ChecklistFeedItem[] = getMockTeamMemberChecklist(userId).map((c) => ({
      id: c.id,
      source: "Personal" as const,
      title: c.title,
      description: c.description,
      recurrence: c.recurrenceType,
      dueDate: c.dueDate,
      status: c.status,
      isOverdue: c.status !== "Completed" && new Date(c.dueDate) < new Date(),
      completedAt: c.completedAt,
    })).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return {
      userId,
      fullName: row?.fullName ?? "Unknown",
      role: (row?.role as Role) ?? "Employee",
      ...computeStats(items),
      items,
    };
  }

  const raw = await apiClient.get<{
    userId: string; fullName: string; role: number;
    todayCount: number; completedTodayCount: number; overdueCount: number; weekCompletionRatePercent: number;
    items: RawChecklistFeedItem[];
  }>(`/checklist/team/${userId}`, { fromUtc, toUtc });

  return {
    userId: raw.userId,
    fullName: raw.fullName,
    role: mapUserRoleEnum(raw.role),
    todayCount: raw.todayCount,
    completedTodayCount: raw.completedTodayCount,
    overdueCount: raw.overdueCount,
    weekCompletionRatePercent: raw.weekCompletionRatePercent,
    items: raw.items.map(mapFeedItem),
  };
}

export async function createChecklistItem(input: { title: string; description?: string; recurrence: ChecklistRecurrence; dueDate: string }): Promise<void> {
  if (API_MODE === "mock") {
    createMockChecklistItem({ title: input.title, description: input.description, recurrenceType: input.recurrence, dueDate: input.dueDate });
    return;
  }
  await apiClient.post<void>("/checklist", {
    title: input.title,
    description: input.description || undefined,
    recurrenceType: mapChecklistRecurrenceToEnum(input.recurrence),
    dueDate: input.dueDate,
  });
}

export async function updateChecklistItem(id: string, input: { title: string; description?: string; dueDate: string }): Promise<void> {
  if (API_MODE === "mock") {
    updateMockChecklistItem(id, input);
    return;
  }
  await apiClient.put<void>(`/checklist/${id}`, { title: input.title, description: input.description || undefined, dueDate: input.dueDate });
}

export async function updateChecklistItemStatus(id: string, status: ChecklistItemStatus): Promise<void> {
  if (API_MODE === "mock") {
    updateMockChecklistItemStatus(id, status);
    return;
  }
  await apiClient.patch<void>(`/checklist/${id}/status`, { status: mapChecklistItemStatusToEnum(status) });
}

export async function deleteChecklistItem(id: string): Promise<void> {
  if (API_MODE === "mock") {
    deleteMockChecklistItem(id);
    return;
  }
  await apiClient.delete<void>(`/checklist/${id}`);
}

// ---------------------------------------------------------------------------
// Export — same JSON-wrapped-base64 FileDownloadResponse pattern as Reports
// (services/reports.ts). Checklist/activity exports are always small (one
// person's or one team's window), so there's no async-queue fallback here.
// ---------------------------------------------------------------------------

export type ChecklistExportResult = { fileName: string; contentType: string; blob: Blob };

function mockExportBlob(scope: "mine" | "team", format: "excel" | "pdf"): ChecklistExportResult {
  const content = `TaskFlow ${scope === "mine" ? "My Activity" : "Team Activity"} export\nGenerated ${new Date().toLocaleString()}`;
  const blob = new Blob([content], { type: format === "excel" ? "application/vnd.ms-excel" : "application/pdf" });
  return { fileName: `${scope}-activity.${format === "excel" ? "xls" : "pdf"}`, contentType: blob.type, blob };
}

async function downloadExport(path: string, scope: "mine" | "team", format: "excel" | "pdf", fromUtc?: string, toUtc?: string): Promise<ChecklistExportResult> {
  if (API_MODE === "mock") {
    return mockExportBlob(scope, format);
  }
  const data = await apiClient.get<{ content: string; fileName: string; contentType: string }>(path, { fromUtc, toUtc });
  const bytes = Uint8Array.from(atob(data.content), (char) => char.charCodeAt(0));
  return { fileName: data.fileName, contentType: data.contentType, blob: new Blob([bytes], { type: data.contentType }) };
}

export function exportMyChecklist(format: "excel" | "pdf", fromUtc?: string, toUtc?: string): Promise<ChecklistExportResult> {
  return downloadExport(`/checklist/export/${format}`, "mine", format, fromUtc, toUtc);
}

export function exportTeamChecklist(format: "excel" | "pdf", fromUtc?: string, toUtc?: string): Promise<ChecklistExportResult> {
  return downloadExport(`/checklist/team/export/${format}`, "team", format, fromUtc, toUtc);
}
