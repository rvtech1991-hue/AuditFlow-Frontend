import * as XLSX from "xlsx";
import { apiClient, ApiError, type PagedResult } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { displayTaskStatus, mapTaskStatusEnum, mapTaskStatusToEnum } from "../lib/taskStatusMapping";
import { mapTaskPriorityEnum, mapTaskPriorityToEnum } from "../lib/taskPriorityMapping";
import { toEndOfDayIso } from "../lib/dateTime";
import {
  addTaskComment as mockAddTaskComment,
  addTaskDocument as mockAddTaskDocument,
  auditTasks,
  createMockTask,
  getRoleScopedTasks,
  getTaskById as mockGetTaskById,
  getTaskFilterOptions as mockGetTaskFilterOptions,
  queryTasks as mockQueryTasks,
  searchTasks as mockSearchTasks,
  taskComments,
  taskDocuments,
  taskStatusHistory,
  updateTaskStatus as mockUpdateTaskStatus,
  type AuditTask,
  type TaskPriority,
  type TaskStatus,
} from "../mock-data/tasks";
import type { Role } from "../types";

export type { TaskPriority, TaskStatus };

function initialsFrom(name: string): string {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Core task entry (list row / detail base) — id is always the routable/API
// identifier (a GUID in live mode, same as the display code in mock mode);
// taskNumber is always the human-readable display code.
// ---------------------------------------------------------------------------

export type TaskEntry = {
  id: string;
  taskNumber: string;
  title: string;
  description: string;
  company: string;
  subCompany: string;
  assignee: string;
  assigneeEmail: string;
  assigneeInitials: string;
  createdBy: string;
  createdOn: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
};

export type TaskComment = {
  id: string;
  author: string;
  authorEmail: string;
  role: string;
  body: string;
  createdAt: string;
};

export type TaskAttachment = {
  id: string;
  name: string;
  uploadedBy: string;
  uploadedAt: string;
  sizeLabel: string;
};

export type TaskTimelineEntry = {
  id: string;
  fromStatus?: TaskStatus;
  toStatus: TaskStatus;
  actor: string;
  reason?: string;
  createdAt: string;
};

export type TaskDetail = TaskEntry & {
  comments: TaskComment[];
  attachments: TaskAttachment[];
  timeline: TaskTimelineEntry[];
};

// Field names verified directly against the backend source (TaskDtos.cs, TaskCommands.cs,
// TaskQueries.cs) rather than guessed — see BACKEND_INTEGRATION_GUIDE SS8.
type RawTaskListItem = {
  id: string;
  taskNumber: string;
  title: string;
  companyName: string;
  subCompanyName: string;
  createdAt: string;
  createdByName: string;
  assignedToName: string;
  assignedToEmail: string;
  status: number;
  priority: number;
  dueDate: string | null;
  isOverdue: boolean;
};

type RawComment = {
  id: string;
  content: string;
  authorName: string;
  authorEmail: string;
  authorRole: string;
  createdAt: string;
};

type RawAttachment = {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedByUserName: string;
  createdAt: string;
};

type RawTimelineItem = {
  id: string;
  previousStatus: number | null;
  newStatus: number;
  changedByName: string;
  reason: string | null;
  changedAt: string;
};

type RawTaskDetail = {
  id: string;
  taskNumber: string;
  title: string;
  description: string | null;
  status: number;
  priority: number;
  companyName: string;
  subCompanyName: string | null;
  assignedToName: string;
  assignedToEmail: string;
  createdByName: string;
  createdAt: string;
  dueDate: string | null;
  isOverdue: boolean;
  comments: RawComment[];
  attachments: RawAttachment[];
  timeline: RawTimelineItem[];
};

function mapComment(raw: RawComment): TaskComment {
  return { id: raw.id, author: raw.authorName, authorEmail: raw.authorEmail, role: raw.authorRole, body: raw.content, createdAt: raw.createdAt };
}

function mapAttachment(raw: RawAttachment): TaskAttachment {
  return { id: raw.id, name: raw.fileName, uploadedBy: raw.uploadedByUserName, uploadedAt: raw.createdAt, sizeLabel: formatFileSize(raw.fileSize) };
}

function mapTimelineItem(raw: RawTimelineItem): TaskTimelineEntry {
  return {
    id: raw.id,
    fromStatus: raw.previousStatus != null ? (mapTaskStatusEnum(raw.previousStatus) as TaskStatus) : undefined,
    toStatus: mapTaskStatusEnum(raw.newStatus) as TaskStatus,
    actor: raw.changedByName,
    reason: raw.reason ?? undefined,
    createdAt: raw.changedAt,
  };
}

function mapTaskListItem(raw: RawTaskListItem): TaskEntry {
  const status = mapTaskStatusEnum(raw.status) as TaskStatus;
  return {
    id: raw.id,
    taskNumber: raw.taskNumber,
    title: raw.title,
    // Not present on the list DTO — only the detail response carries a description.
    description: "",
    company: raw.companyName,
    subCompany: raw.subCompanyName,
    assignee: raw.assignedToName,
    assigneeEmail: raw.assignedToEmail,
    assigneeInitials: initialsFrom(raw.assignedToName),
    createdBy: raw.createdByName,
    createdOn: raw.createdAt.slice(0, 10),
    dueDate: raw.dueDate ? raw.dueDate.slice(0, 10) : "",
    priority: mapTaskPriorityEnum(raw.priority),
    status: displayTaskStatus(status, raw.isOverdue) as TaskStatus,
  };
}

function mapTaskDetail(raw: RawTaskDetail): TaskDetail {
  const status = mapTaskStatusEnum(raw.status) as TaskStatus;
  return {
    id: raw.id,
    taskNumber: raw.taskNumber,
    title: raw.title,
    description: raw.description ?? "",
    company: raw.companyName,
    subCompany: raw.subCompanyName ?? "",
    assignee: raw.assignedToName,
    assigneeEmail: raw.assignedToEmail,
    assigneeInitials: initialsFrom(raw.assignedToName),
    createdBy: raw.createdByName,
    createdOn: raw.createdAt.slice(0, 10),
    dueDate: raw.dueDate ? raw.dueDate.slice(0, 10) : "",
    priority: mapTaskPriorityEnum(raw.priority),
    status: displayTaskStatus(status, raw.isOverdue) as TaskStatus,
    // The backend serializes an empty collection as null rather than [] in some cases (e.g. a
    // task with no attachments/timeline entries yet) — guard so that doesn't throw a raw
    // TypeError out of this mapper, which the details page then shows as a generic "couldn't
    // load" error instead of the real problem.
    comments: (raw.comments ?? []).map(mapComment),
    attachments: (raw.attachments ?? []).map(mapAttachment),
    timeline: (raw.timeline ?? []).map(mapTimelineItem),
  };
}

function taskEntryFromMock(task: AuditTask): TaskEntry {
  return {
    id: task.id,
    taskNumber: task.id,
    title: task.title,
    description: task.description,
    company: task.company,
    subCompany: task.subCompany,
    assignee: task.assignee,
    assigneeEmail: task.assigneeEmail,
    assigneeInitials: task.assigneeInitials,
    createdBy: task.createdBy,
    createdOn: task.createdOn,
    dueDate: task.dueDate,
    priority: task.priority,
    status: task.status,
  };
}

function taskDetailFromMock(task: AuditTask): TaskDetail {
  return {
    ...taskEntryFromMock(task),
    comments: taskComments.filter((c) => c.taskId === task.id).map((c) => ({ id: c.id, author: c.author, authorEmail: "", role: c.role, body: c.body, createdAt: c.createdAt })),
    attachments: taskDocuments.filter((d) => d.taskId === task.id).map((d) => ({ id: d.id, name: d.name, uploadedBy: d.uploadedBy, uploadedAt: d.uploadedAt, sizeLabel: d.size })),
    // Merges the mock's separate "status history" and "audit timeline" concepts into one — the
    // backend only exposes a single status-transition timeline (SS8 "Immutable audit trail"),
    // no broader activity feed (comment-added/attachment-uploaded events aren't queryable).
    timeline: taskStatusHistory.filter((h) => h.taskId === task.id).map((h) => ({ id: h.id, fromStatus: h.from, toStatus: h.to, actor: h.actor, reason: h.comment, createdAt: h.createdAt })),
  };
}

// ---------------------------------------------------------------------------
// List, search, filter options, statistics
// ---------------------------------------------------------------------------

export type FilterOption = { value: string; label: string };

export type TaskFilterOptions = {
  companies: FilterOption[];
  subCompanies: FilterOption[];
  assignees: FilterOption[];
};

type RawTaskFilterOptions = {
  companies: Array<{ id: string; name: string }>;
  subCompanies: Array<{ id: string; name: string }>;
  assignees: Array<{ id: string; fullName: string }>;
};

export async function getTaskFilterOptions(role: Role, userEmail: string): Promise<TaskFilterOptions> {
  if (API_MODE === "mock") {
    const options = mockGetTaskFilterOptions(role, userEmail);
    return {
      companies: options.companies.map((name) => ({ value: name, label: name })),
      subCompanies: options.subCompanies.map((name) => ({ value: name, label: name })),
      assignees: options.assignees.map((name) => ({ value: name, label: name })),
    };
  }
  const data = await apiClient.get<RawTaskFilterOptions>("/tasks/filter-options");
  return {
    companies: data.companies.map((c) => ({ value: c.id, label: c.name })),
    subCompanies: data.subCompanies.map((c) => ({ value: c.id, label: c.name })),
    assignees: data.assignees.map((a) => ({ value: a.id, label: a.fullName })),
  };
}

export type TaskQueryFilters = {
  range: "week" | "all" | "last30" | "quarter";
  // In mock mode these carry display names (matching the FilterOption "value" from the mock
  // branch above); in live mode they carry GUIDs — see getTaskFilterOptions.
  company?: string;
  subCompany?: string;
  assignee?: string;
  status?: Exclude<TaskStatus, "overdue"> | "all";
  query?: string;
  page?: number;
};

// Rendering hundreds/thousands of rows in one page was the actual scaling risk (not just a UI
// nit) — this keeps the DOM and the request itself small regardless of how much task data a
// tenant accumulates over time, rather than fetching (and rendering) up to 100 rows at once.
export const TASK_PAGE_SIZE = 10;

export type TaskPage = {
  items: TaskEntry[];
  totalCount: number;
  pageNumber: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export async function getTasks(role: Role, userEmail: string, filters: TaskQueryFilters): Promise<TaskPage> {
  const page = filters.page ?? 1;
  if (API_MODE === "mock") {
    const allItems = mockQueryTasks(role, userEmail, {
      dateRange: filters.range,
      company: filters.company,
      subCompany: filters.subCompany,
      assignee: filters.assignee,
      status: filters.status === "all" ? "all" : filters.status,
      query: filters.query,
    }).map(taskEntryFromMock);
    const start = (page - 1) * TASK_PAGE_SIZE;
    const items = allItems.slice(start, start + TASK_PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(allItems.length / TASK_PAGE_SIZE));
    return { items, totalCount: allItems.length, pageNumber: page, totalPages, hasPreviousPage: page > 1, hasNextPage: start + TASK_PAGE_SIZE < allItems.length };
  }
  const data = await apiClient.get<PagedResult<RawTaskListItem>>("/tasks", {
    range: filters.range === "week" ? "this-week" : "all",
    companyId: filters.company || undefined,
    subCompanyId: filters.subCompany || undefined,
    assignedToUserId: filters.assignee || undefined,
    status: filters.status && filters.status !== "all" ? mapTaskStatusToEnum(filters.status) : undefined,
    search: filters.query || undefined,
    pageNumber: page,
    pageSize: TASK_PAGE_SIZE,
  });
  return {
    items: data.items.map(mapTaskListItem),
    totalCount: data.totalCount,
    pageNumber: data.pageNumber,
    totalPages: data.totalPages,
    hasPreviousPage: data.hasPreviousPage,
    hasNextPage: data.hasNextPage,
  };
}

export type TaskSearchResult = { id: string; taskNumber: string; title: string };

export async function searchTasks(role: Role, userEmail: string, query: string): Promise<TaskSearchResult[]> {
  if (!query.trim()) return [];
  if (API_MODE === "mock") {
    return mockSearchTasks(role, userEmail, query).map((task) => ({ id: task.id, taskNumber: task.id, title: task.title }));
  }
  const data = await apiClient.get<Array<{ id: string; taskNumber: string; title: string }>>("/tasks/search", { searchTerm: query, limit: 8 });
  return data.map((item) => ({ id: item.id, taskNumber: item.taskNumber, title: item.title }));
}

// ---------------------------------------------------------------------------
// Detail, create, edit, delete, assign, status
// ---------------------------------------------------------------------------

export async function getTaskDetail(taskId: string, role: Role, userEmail: string): Promise<TaskDetail | null> {
  if (API_MODE === "mock") {
    // Mock data has no real access control — the live backend enforces tenant/company/assignee
    // scoping server-side (SS6), so this replicates it here to keep mock mode from letting a
    // role view a task outside its scope just by navigating to the URL directly.
    const task = mockGetTaskById(taskId);
    // TanStack Query treats a queryFn resolving to `undefined` as a bug and turns it into a
    // synthetic error ("Query data cannot be undefined") — `null` is the valid "no data" value.
    if (!task || !getRoleScopedTasks(role, userEmail).some((item) => item.id === taskId)) return null;
    return taskDetailFromMock(task);
  }
  try {
    const data = await apiClient.get<RawTaskDetail>(`/tasks/${taskId}`);
    return mapTaskDetail(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export type CreateTaskDraft = {
  title: string;
  description: string;
  companyId: string;
  companyName: string;
  subCompanyId?: string;
  subCompanyName?: string;
  assigneeId: string;
  assigneeName: string;
  priority: TaskPriority;
  dueDate: string;
};

export async function createTask(draft: CreateTaskDraft, createdByName: string): Promise<TaskEntry> {
  if (API_MODE === "mock") {
    const task = createMockTask({
      title: draft.title,
      description: draft.description,
      company: draft.companyName,
      subCompany: draft.subCompanyName ?? "",
      assignee: draft.assigneeName,
      priority: draft.priority,
      dueDate: draft.dueDate,
      // Attachments are added via the caller's separate uploadAttachment() calls after creation
      // (uniform with live mode, which has no way to attach raw files in the create call itself)
      // — not passed here, to avoid double-adding them in mock mode.
      createdBy: createdByName,
    });
    return taskEntryFromMock(task);
  }
  const data = await apiClient.post<RawTaskDetail>("/tasks", {
    title: draft.title,
    description: draft.description || undefined,
    companyId: draft.companyId,
    subCompanyId: draft.subCompanyId || undefined,
    assignedToUserId: draft.assigneeId,
    priority: mapTaskPriorityToEnum(draft.priority),
    dueDate: draft.dueDate ? toEndOfDayIso(draft.dueDate) : undefined,
  });
  return mapTaskDetail(data);
}

export type UpdateTaskDraft = { title: string; description: string; priority: TaskPriority; dueDate: string };

export async function updateTask(taskId: string, draft: UpdateTaskDraft): Promise<void> {
  if (API_MODE === "mock") {
    const task = mockGetTaskById(taskId);
    if (task) Object.assign(task, { title: draft.title, description: draft.description, priority: draft.priority, dueDate: draft.dueDate });
    return;
  }
  await apiClient.put<void>(`/tasks/${taskId}`, {
    title: draft.title,
    description: draft.description || undefined,
    priority: mapTaskPriorityToEnum(draft.priority),
    dueDate: draft.dueDate ? toEndOfDayIso(draft.dueDate) : undefined,
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  if (API_MODE === "mock") {
    const index = auditTasks.findIndex((t) => t.id === taskId);
    if (index >= 0) auditTasks.splice(index, 1);
    return;
  }
  await apiClient.delete<void>(`/tasks/${taskId}`);
}

export async function assignTask(taskId: string, assigneeId: string, assigneeName: string): Promise<void> {
  if (API_MODE === "mock") {
    const task = mockGetTaskById(taskId);
    if (task) task.assignee = assigneeName;
    return;
  }
  await apiClient.patch<void>(`/tasks/${taskId}/assign`, { newAssignedToUserId: assigneeId });
}

export async function changeTaskStatus(taskId: string, status: Exclude<TaskStatus, "overdue">, actor: string, reason?: string): Promise<void> {
  if (API_MODE === "mock") {
    mockUpdateTaskStatus(taskId, status, actor, reason);
    return;
  }
  await apiClient.patch<void>(`/tasks/${taskId}/status`, { status: mapTaskStatusToEnum(status), reason: reason || undefined });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function addComment(taskId: string, author: string, role: Role, body: string): Promise<void> {
  if (API_MODE === "mock") {
    mockAddTaskComment(taskId, author, role, body);
    return;
  }
  await apiClient.post<void>(`/tasks/${taskId}/comments`, { content: body });
}

// ---------------------------------------------------------------------------
// Attachments — a single call. POST /files/upload with a taskId already
// creates the task-linked Attachment record server-side (confirmed in
// UploadFileCommandHandler.cs) — the separate POST /tasks/{id}/attachments
// endpoint is for the *other* upload path (/files/upload-url, a presigned-URL
// flow where the API never sees the raw bytes and needs the metadata reported
// back separately). Calling both for this path created a duplicate attachment
// per file — fixed after a live-mode repro showed two rows per single upload.
// ---------------------------------------------------------------------------

type RawFileUpload = { fileId: string; fileName: string; storagePath: string; storageProvider: number; fileSize: number; contentType: string };

export async function uploadAttachment(taskId: string, file: File, uploadedBy: string): Promise<void> {
  if (API_MODE === "mock") {
    mockAddTaskDocument(taskId, uploadedBy, file.name);
    return;
  }
  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("taskId", taskId);
  await apiClient.postForm<RawFileUpload>("/files/upload", uploadForm);
}

export async function deleteAttachment(taskId: string, attachmentId: string): Promise<void> {
  if (API_MODE === "mock") return; // mock documents aren't individually deletable in the current UI
  await apiClient.delete<void>(`/tasks/${taskId}/attachments/${attachmentId}`);
}

// ---------------------------------------------------------------------------
// Bulk-create template download — JSON-wrapped base64 content (FileDownloadResponse),
// not a raw stream, since /tasks/template returns ApiResponse<FileDownloadResponse>.
// ---------------------------------------------------------------------------

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The backend only serves the template as CSV, but users overwhelmingly work in Excel — so
 * the CSV response is converted to a real .xlsx workbook client-side before download. If the
 * backend ever starts serving something other than CSV, the original file is returned as-is. */
export async function downloadTaskTemplate(): Promise<{ fileName: string; contentType: string; blob: Blob }> {
  const data = await apiClient.get<{ content: string; fileName: string; contentType: string }>("/tasks/template");
  const bytes = Uint8Array.from(atob(data.content), (char) => char.charCodeAt(0));
  if (!data.fileName.toLowerCase().endsWith(".csv")) {
    return { fileName: data.fileName, contentType: data.contentType, blob: new Blob([bytes], { type: data.contentType }) };
  }
  const rawCsvText = new TextDecoder().decode(bytes);
  // Strip the backend's "valid values for this tenant" reference block (each of those rows'
  // title is prefixed "#") — the downloaded template should just be the header users fill in.
  const [headerLine, ...dataLines] = rawCsvText.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  const csvText = [headerLine, ...dataLines.filter((line) => !parseCsvLine(line)[0]?.trim().startsWith("#"))].join("\n");
  const workbook = XLSX.read(csvText, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // Parsing CSV text auto-detects "2026-08-20"-style example values as bare numeric serials
  // with no date format attached — without this, they'd open in Excel as e.g. "46254" instead
  // of a date.
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const cell = sheet[address];
    if (cell?.t === "n" && !cell.z && typeof cell.w === "string" && isoDatePattern.test(cell.w)) {
      cell.z = "yyyy-mm-dd";
    }
  }
  const xlsxBytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return {
    fileName: data.fileName.replace(/\.csv$/i, ".xlsx"),
    contentType: XLSX_CONTENT_TYPE,
    blob: new Blob([xlsxBytes], { type: XLSX_CONTENT_TYPE }),
  };
}

// ---------------------------------------------------------------------------
// Bulk create (live mode only — see TaskBulkCreatePage.tsx for the mock-mode
// simulated flow, which is untouched). CSV only: POST /tasks/bulk/import needs
// full row data (title/description/company/subCompany/assigneeEmail/priority/
// dueDate) that the validate step's response doesn't return — the frontend has
// to parse the uploaded file itself to reconstruct it, and the backend's own
// column parser (BulkUploadTasksCommandHandler) is strictly positional CSV.
// ---------------------------------------------------------------------------

export type BulkRowInput = {
  rowNumber: number;
  title: string;
  description: string;
  company: string;
  subCompany: string;
  assigneeEmail: string;
  priority: TaskPriority | "";
  dueDate: string;
};

export type BulkRowValidation = { valid: boolean; reason: string };

export type BulkReferenceData = {
  companies: Array<{ id: string; name: string }>;
  subCompanies: Array<{ id: string; name: string; companyId: string }>;
  assignees: Array<{ email: string; companyName: string | null }>;
};

type RawBulkFilterOptions = {
  companies: Array<{ id: string; name: string }>;
  subCompanies: Array<{ id: string; name: string; companyId: string }>;
  assignees: Array<{ email: string; companyName: string | null }>;
};

export async function getBulkReferenceData(): Promise<BulkReferenceData> {
  const data = await apiClient.get<RawBulkFilterOptions>("/tasks/filter-options");
  return data;
}

export function isExcelFile(file: File): boolean {
  return /\.xlsx?$/i.test(file.name);
}

/** Backend's bulk parser only understands CSV, so an uploaded Excel workbook is converted
 * client-side (first sheet only) before it ever reaches validate/import. Date cells carry a
 * cached display format (e.g. "m/d/yy") baked in by Excel — sheet_to_csv's `dateNF` option is
 * ignored whenever that cache is already set, so each date cell's format/cache is cleared and
 * pinned to ISO (yyyy-mm-dd) before conversion. Without this, dates round-trip as "8/15/26"
 * instead of "2026-08-15", which is what was breaking the <input type="date"> preview and the
 * import call. */
export async function convertExcelFileToCsv(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const cell = sheet[address];
    if (cell?.t === "d") {
      cell.z = "yyyy-mm-dd";
      delete cell.w;
    }
  }
  const csv = XLSX.utils.sheet_to_csv(sheet, { dateNF: "yyyy-mm-dd" });
  return new File([csv], file.name.replace(/\.xlsx?$/i, ".csv"), { type: "text/csv" });
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Row 1 is the header (skipped) — matches BulkUploadTasksCommandHandler's row numbering,
 * where data rows are numbered starting from 2. The downloaded template appends a "valid
 * values for this tenant" reference block below the header, with each row's title prefixed
 * "#" and a note to delete it before uploading — rows still there when a user uploads are
 * skipped rather than surfaced as bogus/invalid tasks. */
export function parseTaskCsv(text: string): BulkRowInput[] {
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  return lines
    .slice(1)
    .map((line, index) => {
      const fields = parseCsvLine(line);
      const field = (i: number) => (fields[i] ?? "").trim();
      return {
        rowNumber: index + 2,
        title: field(0),
        description: field(1),
        company: field(2),
        subCompany: field(3),
        assigneeEmail: field(4),
        priority: (field(5) as TaskPriority) || "",
        dueDate: field(6),
      };
    })
    .filter((row) => !row.title.startsWith("#"));
}

/** Client-side re-check for a row after inline editing — there's no per-row re-validate
 * endpoint, only a whole-file one, so edited rows can't get another server round-trip without
 * re-uploading. Uses the same reference data (SS8 /tasks/filter-options) the server itself
 * would check against, so it's a faithful approximation, not a guess. */
export function validateBulkRow(row: BulkRowInput, reference: BulkReferenceData): BulkRowValidation {
  const reasons: string[] = [];
  if (!row.title.trim()) reasons.push("Title is required");
  const company = reference.companies.find((c) => c.name.toLowerCase() === row.company.trim().toLowerCase());
  if (!company) reasons.push("Company is not recognized");
  if (company && row.subCompany.trim() && !reference.subCompanies.some((sc) => sc.companyId === company.id && sc.name.toLowerCase() === row.subCompany.trim().toLowerCase())) {
    reasons.push("Sub-company is not under company");
  }
  const assignee = reference.assignees.find((a) => a.email.toLowerCase() === row.assigneeEmail.trim().toLowerCase());
  if (!assignee) reasons.push("No matching active user for that assignee email");
  else if (company && assignee.companyName && assignee.companyName !== company.name) reasons.push("Assignee is not available for company");
  if (!row.priority) reasons.push("Priority is required");
  if (!row.dueDate.trim()) reasons.push("Due date is required");
  return { valid: reasons.length === 0, reason: reasons.join("; ") };
}

export type BulkValidationOutcome = { rowNumber: number; valid: boolean; reason: string };

/** Server-authoritative validation for the initial upload (matches the real business rules in
 * BulkUploadTasksCommandHandler, which is stricter/more current than the client-side re-check
 * above — e.g. it knows about Active-status filtering that the reference data alone may not). */
export async function validateBulkFile(file: File): Promise<BulkValidationOutcome[]> {
  const formData = new FormData();
  formData.append("file", file);
  const data = await apiClient.postForm<{
    errors: Array<{ row: number; field: string; message: string }>;
    validRowsPreview: Array<{ row: number }>;
  }>("/tasks/bulk/validate", formData);

  const reasonsByRow = new Map<number, string[]>();
  for (const error of data.errors) {
    const list = reasonsByRow.get(error.row) ?? [];
    list.push(error.message);
    reasonsByRow.set(error.row, list);
  }
  const validRows = new Set(data.validRowsPreview.map((r) => r.row));

  return Array.from(new Set([...reasonsByRow.keys(), ...validRows])).map((rowNumber) => ({
    rowNumber,
    valid: validRows.has(rowNumber),
    reason: (reasonsByRow.get(rowNumber) ?? []).join("; "),
  }));
}

export async function importBulkTasks(rows: BulkRowInput[]): Promise<{ importedCount: number; skippedCount: number }> {
  const data = await apiClient.post<{ importedCount: number; skippedCount: number }>("/tasks/bulk/import", {
    validRows: rows.map((row) => ({
      title: row.title,
      description: row.description || undefined,
      companyName: row.company,
      subCompanyName: row.subCompany || undefined,
      assigneeEmail: row.assigneeEmail,
      priority: mapTaskPriorityToEnum(row.priority as TaskPriority),
      dueDate: row.dueDate || undefined,
    })),
  });
  return data;
}
