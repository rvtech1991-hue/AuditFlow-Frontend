import type { TaskPriority } from "../mock-data/tasks";

// TaskPriority enum values, confirmed against the backend source
// (src/AuditFlow.Domain/Common/Enums.cs) — matches BACKEND_INTEGRATION_GUIDE SS7.
const PRIORITY_FROM_ENUM: Record<number, TaskPriority> = {
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Critical",
};

const ENUM_FROM_PRIORITY: Record<TaskPriority, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

export function mapTaskPriorityEnum(value: number): TaskPriority {
  return PRIORITY_FROM_ENUM[value] ?? "Medium";
}

export function mapTaskPriorityToEnum(priority: TaskPriority): number {
  return ENUM_FROM_PRIORITY[priority];
}
