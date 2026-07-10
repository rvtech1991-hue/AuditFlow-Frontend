import type { Role, Status } from "../types";

export type TaskStatus = Extract<Status, "open" | "progress" | "overdue" | "closed"> | "resolved";
export type TaskPriority = "High" | "Medium" | "Low";

export type AuditTask = {
  id: string;
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
  currentWeek: boolean;
  attachmentNames?: string[];
};

export type TaskFilters = {
  company?: string;
  subCompany?: string;
  assignee?: string;
  status?: TaskStatus | "all";
  dateRange?: "week" | "all" | "last30" | "quarter";
  query?: string;
};

export type NewTaskInput = {
  title: string;
  description: string;
  company: string;
  subCompany: string;
  assignee: string;
  priority: TaskPriority;
  dueDate: string;
  attachmentNames?: string[];
  createdBy: string;
};

export type MockNotification = {
  id: string;
  taskId: string;
  message: string;
  createdAt: string;
};

export type TaskComment = {
  id: string;
  taskId: string;
  author: string;
  role: Role;
  body: string;
  createdAt: string;
};

export type TaskDocument = {
  id: string;
  taskId: string;
  name: string;
  uploadedBy: string;
  uploadedAt: string;
  size: string;
};

export type StatusHistoryEntry = {
  id: string;
  taskId: string;
  from?: TaskStatus;
  to: TaskStatus;
  actor: string;
  createdAt: string;
  comment?: string;
};

export type AuditTimelineEntry = {
  id: string;
  taskId: string;
  actor: string;
  action: string;
  createdAt: string;
  detail: string;
};

export const taskDirectory = [
  {
    company: "Meridian Group",
    subCompanies: ["Warehouse 3", "North Finance", "South Plant", "Corporate"],
    assignees: [
      { name: "Nisha Rao", email: "nisha@meridian.com", initials: "NR" },
      { name: "Dev Mehta", email: "dev@meridian.com", initials: "DM" },
      { name: "A. Verma", email: "a.verma@meridian.com", initials: "AV" },
    ],
  },
  {
    company: "Kestrel Logistics",
    subCompanies: ["Depot East", "Depot West"],
    assignees: [
      { name: "Anika Shah", email: "anika@kestrel.com", initials: "AS" },
      { name: "J. Tan", email: "j.tan@kestrel.com", initials: "JT" },
    ],
  },
  {
    company: "Patel & Co.",
    subCompanies: ["Shared Services", "Retail Audit"],
    assignees: [
      { name: "Rahul Iyer", email: "rahul@patelco.com", initials: "RI" },
      { name: "A. Verma", email: "a.verma@meridian.com", initials: "AV" },
    ],
  },
];

export const auditTasks: AuditTask[] = [
  {
    id: "AF-1024",
    title: "Bank reconciliation mismatch",
    description: "Cash book closing balance does not match the bank confirmation shared for the audit period.",
    company: "Meridian Group",
    subCompany: "North Finance",
    assignee: "Nisha Rao",
    assigneeEmail: "nisha@meridian.com",
    assigneeInitials: "NR",
    createdBy: "Rakesh Kumar",
    createdOn: "2026-07-06",
    dueDate: "2026-07-11",
    priority: "High",
    status: "progress",
    currentWeek: true,
  },
  {
    id: "AF-1025",
    title: "GST input credit evidence missing",
    description: "Supplier invoice packet is missing the input credit evidence required for sign-off.",
    company: "Meridian Group",
    subCompany: "South Plant",
    assignee: "Dev Mehta",
    assigneeEmail: "dev@meridian.com",
    assigneeInitials: "DM",
    createdBy: "Rakesh Kumar",
    createdOn: "2026-07-05",
    dueDate: "2026-07-07",
    priority: "High",
    status: "overdue",
    currentWeek: true,
  },
  {
    id: "AF-1026",
    title: "Payroll approval trail incomplete",
    description: "June payroll run does not include the final approver evidence in the exported control pack.",
    company: "Kestrel Logistics",
    subCompany: "Depot East",
    assignee: "Anika Shah",
    assigneeEmail: "anika@kestrel.com",
    assigneeInitials: "AS",
    createdBy: "Maya Thomas",
    createdOn: "2026-07-04",
    dueDate: "2026-07-09",
    priority: "Medium",
    status: "closed",
    currentWeek: true,
  },
  {
    id: "AF-1027",
    title: "Vendor onboarding checklist gap",
    description: "Two high-value vendors were activated without sanctions screening confirmation.",
    company: "Patel & Co.",
    subCompany: "Shared Services",
    assignee: "Rahul Iyer",
    assigneeEmail: "rahul@patelco.com",
    assigneeInitials: "RI",
    createdBy: "Rakesh Kumar",
    createdOn: "2026-07-03",
    dueDate: "2026-07-15",
    priority: "Medium",
    status: "open",
    currentWeek: true,
  },
  {
    id: "AF-1028",
    title: "Missing fixed asset verification",
    description: "Asset sample for Depot West lacks physical verification photographs and custodian acknowledgement.",
    company: "Kestrel Logistics",
    subCompany: "Depot West",
    assignee: "J. Tan",
    assigneeEmail: "j.tan@kestrel.com",
    assigneeInitials: "JT",
    createdBy: "Maya Thomas",
    createdOn: "2026-06-25",
    dueDate: "2026-07-01",
    priority: "High",
    status: "overdue",
    currentWeek: false,
  },
  {
    id: "AF-1029",
    title: "Expense policy exception not approved",
    description: "Travel reimbursement exception was processed without the CFO approval note.",
    company: "Meridian Group",
    subCompany: "Corporate",
    assignee: "A. Verma",
    assigneeEmail: "a.verma@meridian.com",
    assigneeInitials: "AV",
    createdBy: "Rakesh Kumar",
    createdOn: "2026-06-21",
    dueDate: "2026-07-12",
    priority: "Low",
    status: "progress",
    currentWeek: false,
  },
  {
    id: "AF-1030",
    title: "Revenue cutoff support pending",
    description: "Dispatch documents for the final two June invoices have not been uploaded.",
    company: "Meridian Group",
    subCompany: "Corporate",
    assignee: "A. Verma",
    assigneeEmail: "a.verma@meridian.com",
    assigneeInitials: "AV",
    createdBy: "Rakesh Kumar",
    createdOn: "2026-07-07",
    dueDate: "2026-07-13",
    priority: "High",
    status: "open",
    currentWeek: true,
  },
  {
    id: "AF-1031",
    title: "Inventory count variance explanation",
    description: "Cycle count variance exceeds tolerance and needs a signed variance explanation.",
    company: "Patel & Co.",
    subCompany: "Retail Audit",
    assignee: "A. Verma",
    assigneeEmail: "a.verma@meridian.com",
    assigneeInitials: "AV",
    createdBy: "Rakesh Kumar",
    createdOn: "2026-06-15",
    dueDate: "2026-06-26",
    priority: "Medium",
    status: "resolved",
    currentWeek: false,
  },
  {
    id: "AF-1032",
    title: "Document retention policy acknowledgement",
    description: "Company admin must upload acknowledgement for updated document retention controls.",
    company: "Meridian Group",
    subCompany: "North Finance",
    assignee: "Nisha Rao",
    assigneeEmail: "nisha@meridian.com",
    assigneeInitials: "NR",
    createdBy: "Maya Thomas",
    createdOn: "2026-05-30",
    dueDate: "2026-06-12",
    priority: "Low",
    status: "closed",
    currentWeek: false,
  },
];

export const taskCompanies = Array.from(new Set(auditTasks.map((task) => task.company)));
export const taskSubCompanies = Array.from(new Set(auditTasks.map((task) => task.subCompany)));
export const taskAssignees = Array.from(new Set(auditTasks.map((task) => task.assignee)));
export const mockNotifications: MockNotification[] = [];

export const taskComments: TaskComment[] = [
  {
    id: "CMT-1",
    taskId: "AF-1024",
    author: "Rakesh Kumar",
    role: "Auditor",
    body: "Please reconcile the variance against the bank confirmation and upload the corrected schedule.",
    createdAt: "2026-07-06T10:15:00",
  },
  {
    id: "CMT-2",
    taskId: "AF-1024",
    author: "Nisha Rao",
    role: "Employee",
    body: "I am checking the final bank statement extract and will attach the updated workbook today.",
    createdAt: "2026-07-07T15:40:00",
  },
];

export const taskDocuments: TaskDocument[] = [
  { id: "DOC-1", taskId: "AF-1024", name: "bank_confirmation_june.pdf", uploadedBy: "Rakesh Kumar", uploadedAt: "2026-07-06T10:18:00", size: "248 KB" },
  { id: "DOC-2", taskId: "AF-1024", name: "cashbook_reconciliation.xlsx", uploadedBy: "Nisha Rao", uploadedAt: "2026-07-07T16:05:00", size: "412 KB" },
  { id: "DOC-3", taskId: "AF-1030", name: "dispatch_register_june.xlsx", uploadedBy: "A. Verma", uploadedAt: "2026-07-08T11:20:00", size: "331 KB" },
];

export const taskStatusHistory: StatusHistoryEntry[] = [
  { id: "ST-1", taskId: "AF-1024", to: "open", actor: "Rakesh Kumar", createdAt: "2026-07-06T09:30:00" },
  { id: "ST-2", taskId: "AF-1024", from: "open", to: "progress", actor: "Nisha Rao", createdAt: "2026-07-07T10:05:00", comment: "Started reconciliation review." },
  { id: "ST-3", taskId: "AF-1026", to: "open", actor: "Maya Thomas", createdAt: "2026-07-04T08:50:00" },
  { id: "ST-4", taskId: "AF-1026", from: "open", to: "progress", actor: "Anika Shah", createdAt: "2026-07-05T12:10:00" },
  { id: "ST-5", taskId: "AF-1026", from: "progress", to: "resolved", actor: "Anika Shah", createdAt: "2026-07-07T16:30:00" },
  { id: "ST-6", taskId: "AF-1026", from: "resolved", to: "closed", actor: "Maya Thomas", createdAt: "2026-07-08T09:20:00", comment: "Evidence accepted." },
];

export const taskAuditTimeline: AuditTimelineEntry[] = [
  { id: "TL-1", taskId: "AF-1024", actor: "Rakesh Kumar", action: "Task created", createdAt: "2026-07-06T09:30:00", detail: "Created high-priority task and assigned it to Nisha Rao." },
  { id: "TL-2", taskId: "AF-1024", actor: "Rakesh Kumar", action: "Document uploaded", createdAt: "2026-07-06T10:18:00", detail: "Added bank_confirmation_june.pdf." },
  { id: "TL-3", taskId: "AF-1024", actor: "Nisha Rao", action: "Status changed", createdAt: "2026-07-07T10:05:00", detail: "Changed status from Open to In progress." },
  { id: "TL-4", taskId: "AF-1024", actor: "Nisha Rao", action: "Comment added", createdAt: "2026-07-07T15:40:00", detail: "Added an update on the reconciliation review." },
];

function isInDateRange(task: AuditTask, dateRange: NonNullable<TaskFilters["dateRange"]>) {
  const createdOn = new Date(`${task.createdOn}T00:00:00`).getTime();
  const today = new Date("2026-07-09T00:00:00").getTime();
  const day = 24 * 60 * 60 * 1000;

  if (dateRange === "week") return task.currentWeek;
  if (dateRange === "last30") return today - createdOn <= 30 * day;
  if (dateRange === "quarter") return today - createdOn <= 90 * day;
  return true;
}

function matchesTaskSearch(task: AuditTask, query: string) {
  const normalized = query.toLowerCase();
  return `${task.id} ${task.title} ${task.description}`.toLowerCase().includes(normalized);
}

export function getRoleScopedTasks(role: Role, userEmail: string) {
  if (role === "Company admin") {
    return auditTasks.filter((task) => task.company === "Meridian Group");
  }
  if (role === "Employee") {
    const normalized = userEmail.toLowerCase();
    return auditTasks.filter((task) => task.assigneeEmail.toLowerCase() === normalized);
  }
  if (role === "Platform admin") {
    return [];
  }
  return auditTasks;
}

export function getTaskFilterOptions(role: Role, userEmail: string) {
  const scopedTasks = getRoleScopedTasks(role, userEmail);
  return {
    companies: Array.from(new Set(scopedTasks.map((task) => task.company))),
    subCompanies: Array.from(new Set(scopedTasks.map((task) => task.subCompany))),
    assignees: Array.from(new Set(scopedTasks.map((task) => task.assignee))),
  };
}

export function queryTasks(role: Role, userEmail: string, filters: TaskFilters) {
  let tasks = getRoleScopedTasks(role, userEmail);

  if (filters.dateRange) {
    tasks = tasks.filter((task) => isInDateRange(task, filters.dateRange!));
  }
  if (filters.company) {
    tasks = tasks.filter((task) => task.company === filters.company);
  }
  if (filters.subCompany) {
    tasks = tasks.filter((task) => task.subCompany === filters.subCompany);
  }
  if (filters.assignee) {
    tasks = tasks.filter((task) => task.assignee === filters.assignee);
  }
  if (filters.status && filters.status !== "all") {
    tasks = tasks.filter((task) => task.status === filters.status);
  }
  if (filters.query) {
    tasks = tasks.filter((task) => matchesTaskSearch(task, filters.query!));
  }

  return tasks;
}

export function searchTasks(role: Role, userEmail: string, query: string) {
  if (!query.trim()) return [];
  const normalized = query.trim().toLowerCase();
  return getRoleScopedTasks(role, userEmail)
    .filter((task) => `${task.id} ${task.description}`.toLowerCase().includes(normalized))
    .slice(0, 6);
}

function nextTaskId() {
  const max = auditTasks.reduce((latest, task) => {
    const numeric = Number(task.id.replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(latest, numeric) : latest;
  }, 1032);
  return `AF-${max + 1}`;
}

function findAssignee(name: string) {
  return taskDirectory.flatMap((company) => company.assignees).find((assignee) => assignee.name === name);
}

function nowStamp() {
  return "2026-07-09T11:45:00";
}

function statusLabel(status: TaskStatus) {
  if (status === "progress") return "In progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function appendTimeline(taskId: string, actor: string, action: string, detail: string) {
  taskAuditTimeline.push({
    id: `TL-${taskAuditTimeline.length + 1}`,
    taskId,
    actor,
    action,
    detail,
    createdAt: nowStamp(),
  });
}

export function getTaskById(taskId: string) {
  return auditTasks.find((task) => task.id === taskId);
}

export function updateTaskStatus(taskId: string, nextStatus: TaskStatus, actor: string, comment?: string) {
  const task = getTaskById(taskId);
  if (!task || task.status === nextStatus) return task;

  const previous = task.status;
  task.status = nextStatus;
  taskStatusHistory.unshift({
    id: `ST-${taskStatusHistory.length + 1}`,
    taskId,
    from: previous,
    to: nextStatus,
    actor,
    comment,
    createdAt: nowStamp(),
  });
  appendTimeline(taskId, actor, "Status changed", `Changed status from ${statusLabel(previous)} to ${statusLabel(nextStatus)}${comment ? `: ${comment}` : "."}`);
  return task;
}

export function addTaskComment(taskId: string, author: string, role: Role, body: string) {
  const comment: TaskComment = {
    id: `CMT-${taskComments.length + 1}`,
    taskId,
    author,
    role,
    body,
    createdAt: nowStamp(),
  };
  taskComments.unshift(comment);
  appendTimeline(taskId, author, "Comment added", "Added a comment.");
  return comment;
}

export function addTaskDocument(taskId: string, uploadedBy: string, name: string) {
  const document: TaskDocument = {
    id: `DOC-${taskDocuments.length + 1}`,
    taskId,
    name,
    uploadedBy,
    uploadedAt: nowStamp(),
    size: "Mock file",
  };
  taskDocuments.unshift(document);
  appendTimeline(taskId, uploadedBy, "Document uploaded", `Added ${name}.`);
  return document;
}

export function createMockTask(input: NewTaskInput) {
  const assignee = findAssignee(input.assignee);
  const task: AuditTask = {
    id: nextTaskId(),
    title: input.title,
    description: input.description,
    company: input.company,
    subCompany: input.subCompany,
    assignee: input.assignee,
    assigneeEmail: assignee?.email ?? `${input.assignee.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    assigneeInitials: assignee?.initials ?? input.assignee.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    createdBy: input.createdBy,
    createdOn: "2026-07-09",
    dueDate: input.dueDate,
    priority: input.priority,
    status: "open",
    currentWeek: true,
    attachmentNames: input.attachmentNames ?? [],
  };

  auditTasks.unshift(task);
  taskStatusHistory.unshift({
    id: `ST-${taskStatusHistory.length + 1}`,
    taskId: task.id,
    to: "open",
    actor: input.createdBy,
    createdAt: "2026-07-09T10:30:00",
  });
  appendTimeline(task.id, input.createdBy, "Task created", `Created ${task.priority.toLowerCase()}-priority task and assigned it to ${task.assignee}.`);
  task.attachmentNames?.forEach((name) => addTaskDocument(task.id, input.createdBy, name));
  mockNotifications.unshift({
    id: `NTF-${mockNotifications.length + 1}`,
    taskId: task.id,
    message: `${task.id} assigned to ${task.assignee}`,
    createdAt: "2026-07-09T10:30:00",
  });

  return task;
}

export { taskAuditTimeline as auditTimeline };