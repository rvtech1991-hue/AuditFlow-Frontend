import type { Status } from "../types";

/** The subset of Status that can apply to a task (excludes the user-status values "active"/"invited"). */
export type TaskStatus = Exclude<Status, "active" | "invited">;

// AuditTaskStatus enum values, confirmed against the backend source
// (src/AuditFlow.Domain/Common/Enums.cs) — matches BACKEND_INTEGRATION_GUIDE SS7.
const STATUS_FROM_ENUM: Record<number, TaskStatus> = {
  1: "open",
  2: "progress",
  3: "resolved",
  4: "closed",
  5: "reopened",
};

export function mapTaskStatusEnum(value: number): TaskStatus {
  return STATUS_FROM_ENUM[value] ?? "open";
}

/** The existing UI renders a single status badge per task row. `isOverdue` is a derived flag,
 * not a real status (SS7) — this gives it display precedence over the real status for that one
 * badge, matching the pre-integration mock data's convention, without collapsing the two
 * concepts anywhere else (the real status and isOverdue stay separate fields on the DTO). */
export function displayTaskStatus(status: TaskStatus, isOverdue: boolean): TaskStatus {
  if (isOverdue && status !== "closed" && status !== "resolved") return "overdue";
  return status;
}

const ENUM_FROM_STATUS: Record<Exclude<TaskStatus, "overdue">, number> = {
  open: 1,
  progress: 2,
  resolved: 3,
  closed: 4,
  reopened: 5,
};

/** "overdue" is never a settable status (SS7) — the parameter type excludes it at compile time. */
export function mapTaskStatusToEnum(status: Exclude<TaskStatus, "overdue">): number {
  return ENUM_FROM_STATUS[status];
}
