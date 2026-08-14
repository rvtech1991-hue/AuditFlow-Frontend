export type MockChecklistRecurrence = "OneTime" | "Daily" | "Weekly" | "Monthly";
export type MockChecklistStatus = "Pending" | "InProgress" | "Completed";

export type MockChecklistItem = {
  id: string;
  title: string;
  description: string;
  recurrenceType: MockChecklistRecurrence;
  dueDate: string; // ISO
  status: MockChecklistStatus;
  completedAt: string | null;
};

function isoAt(daysFromToday: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let nextId = 100;

// Seed data isn't scoped to a specific mock user — this app's mock mode is a role-switcher demo,
// not a per-account sandbox, so the checklist (like every other mock dataset here) just needs to
// look populated and exercise every state (today/overdue/completed/recurring) regardless of which
// demo role is currently selected.
export let mockChecklistItems: MockChecklistItem[] = [
  {
    id: "chk-1",
    title: "Review pending evidence uploads",
    description: "",
    recurrenceType: "Daily",
    dueDate: isoAt(0, 18, 0),
    status: "Pending",
    completedAt: null,
  },
  {
    id: "chk-2",
    title: "Submit weekly status update to reporting manager",
    description: "",
    recurrenceType: "Weekly",
    dueDate: isoAt(0, 17, 0),
    status: "InProgress",
    completedAt: null,
  },
  {
    id: "chk-3",
    title: "Stand-up notes for current engagement",
    description: "",
    recurrenceType: "Daily",
    dueDate: isoAt(0, 9, 12),
    status: "Completed",
    completedAt: isoAt(0, 9, 12),
  },
  {
    id: "chk-4",
    title: "Follow up with client on missing documents",
    description: "",
    recurrenceType: "OneTime",
    dueDate: isoAt(-2, 17, 0),
    status: "Pending",
    completedAt: null,
  },
  {
    id: "chk-5",
    title: "Prepare Q3 compliance checklist draft",
    description: "",
    recurrenceType: "Monthly",
    dueDate: isoAt(12, 12, 0),
    status: "Pending",
    completedAt: null,
  },
];

export function getMockChecklistItems(): MockChecklistItem[] {
  return mockChecklistItems;
}

export function createMockChecklistItem(input: { title: string; description?: string; recurrenceType: MockChecklistRecurrence; dueDate: string }): MockChecklistItem {
  const item: MockChecklistItem = {
    id: `chk-${nextId++}`,
    title: input.title,
    description: input.description ?? "",
    recurrenceType: input.recurrenceType,
    dueDate: input.dueDate,
    status: "Pending",
    completedAt: null,
  };
  mockChecklistItems = [...mockChecklistItems, item];
  return item;
}

export function updateMockChecklistItem(id: string, input: { title: string; description?: string; dueDate: string }): MockChecklistItem | undefined {
  let updated: MockChecklistItem | undefined;
  mockChecklistItems = mockChecklistItems.map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, title: input.title, description: input.description ?? "", dueDate: input.dueDate };
    return updated;
  });
  return updated;
}

export function updateMockChecklistItemStatus(id: string, status: MockChecklistStatus): MockChecklistItem | undefined {
  let updated: MockChecklistItem | undefined;
  mockChecklistItems = mockChecklistItems.map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, status, completedAt: status === "Completed" ? new Date().toISOString() : null };
    return updated;
  });
  return updated;
}

export function deleteMockChecklistItem(id: string): void {
  mockChecklistItems = mockChecklistItems.filter((item) => item.id !== id);
}

export type MockTeamChecklistRow = {
  userId: string;
  fullName: string;
  role: string;
  todayCount: number;
  completedTodayCount: number;
  overdueCount: number;
  weekCompletionRatePercent: number;
  lastUpdateAt: string | null;
};

export function getMockTeamChecklist(): MockTeamChecklistRow[] {
  return [
    { userId: "u-aditi", fullName: "Aditi", role: "Employee", todayCount: 4, completedTodayCount: 3, overdueCount: 0, weekCompletionRatePercent: 88, lastUpdateAt: isoAt(0, 10, 40) },
    { userId: "u-manoj", fullName: "Manoj Kumar", role: "Employee", todayCount: 5, completedTodayCount: 2, overdueCount: 2, weekCompletionRatePercent: 54, lastUpdateAt: isoAt(0, 8, 5) },
    { userId: "u-companyadmin", fullName: "Seed Company Admin", role: "Company admin", todayCount: 2, completedTodayCount: 2, overdueCount: 0, weekCompletionRatePercent: 100, lastUpdateAt: isoAt(-1, 15, 0) },
  ];
}

const mockTeamMemberItems: Record<string, MockChecklistItem[]> = {
  "u-aditi": [
    { id: "chk-t1", title: "Reconcile vendor ledger for Tata Motors", description: "", recurrenceType: "Daily", dueDate: isoAt(0, 11, 0), status: "Completed", completedAt: isoAt(0, 10, 40) },
    { id: "chk-t2", title: "Upload signed confirmation letters", description: "", recurrenceType: "OneTime", dueDate: isoAt(0, 16, 0), status: "InProgress", completedAt: null },
  ],
  "u-manoj": [
    { id: "chk-t3", title: "Follow up on missing invoices", description: "", recurrenceType: "OneTime", dueDate: isoAt(-1, 17, 0), status: "Pending", completedAt: null },
    { id: "chk-t4", title: "Weekly reconciliation summary", description: "", recurrenceType: "Weekly", dueDate: isoAt(-2, 12, 0), status: "Pending", completedAt: null },
    { id: "chk-t5", title: "Daily stand-up notes", description: "", recurrenceType: "Daily", dueDate: isoAt(0, 8, 5), status: "Completed", completedAt: isoAt(0, 8, 5) },
  ],
  "u-companyadmin": [
    { id: "chk-t6", title: "Review team submissions", description: "", recurrenceType: "Daily", dueDate: isoAt(-1, 15, 0), status: "Completed", completedAt: isoAt(-1, 15, 0) },
  ],
};

export function getMockTeamMemberChecklist(userId: string): MockChecklistItem[] {
  return mockTeamMemberItems[userId] ?? [];
}
