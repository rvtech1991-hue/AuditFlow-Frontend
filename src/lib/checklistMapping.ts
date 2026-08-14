// ChecklistRecurrenceType / ChecklistItemStatus enum values, confirmed against the backend
// source (src/AuditFlow.Domain/Common/Enums.cs) — same wire convention as every other backend
// enum (see taskStatusMapping.ts): plain ints over JSON, never strings.

export type ChecklistRecurrence = "OneTime" | "Daily" | "Weekly" | "Monthly";

const RECURRENCE_FROM_ENUM: Record<number, ChecklistRecurrence> = {
  1: "OneTime",
  2: "Daily",
  3: "Weekly",
  4: "Monthly",
};

export function mapChecklistRecurrenceEnum(value: number): ChecklistRecurrence {
  return RECURRENCE_FROM_ENUM[value] ?? "OneTime";
}

const ENUM_FROM_RECURRENCE: Record<ChecklistRecurrence, number> = {
  OneTime: 1,
  Daily: 2,
  Weekly: 3,
  Monthly: 4,
};

export function mapChecklistRecurrenceToEnum(value: ChecklistRecurrence): number {
  return ENUM_FROM_RECURRENCE[value];
}

export const RECURRENCE_LABELS: Record<ChecklistRecurrence, string> = {
  OneTime: "One-time",
  Daily: "Daily",
  Weekly: "Weekly",
  Monthly: "Monthly",
};

/** A personal checklist item's own status. */
export type ChecklistItemStatus = "Pending" | "InProgress" | "Completed";

const CHECKLIST_STATUS_FROM_ENUM: Record<number, ChecklistItemStatus> = {
  1: "Pending",
  2: "InProgress",
  3: "Completed",
};

export function mapChecklistItemStatusEnum(value: number): ChecklistItemStatus {
  return CHECKLIST_STATUS_FROM_ENUM[value] ?? "Pending";
}

const ENUM_FROM_CHECKLIST_STATUS: Record<ChecklistItemStatus, number> = {
  Pending: 1,
  InProgress: 2,
  Completed: 3,
};

export function mapChecklistItemStatusToEnum(value: ChecklistItemStatus): number {
  return ENUM_FROM_CHECKLIST_STATUS[value];
}

export const CHECKLIST_STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  Pending: "Pending",
  InProgress: "In progress",
  Completed: "Completed",
};
