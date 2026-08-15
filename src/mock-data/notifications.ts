export type NotificationKind = "assignment" | "status" | "comment" | "reopened" | "closed" | "mention" | "invitation" | "announcement" | "report" | "reminder";

export type MockNotification = {
  id: string;
  taskId?: string;
  kind: NotificationKind;
  read: boolean;
  message: string;
  createdAt: string;
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const mockNotifications: MockNotification[] = [
  { id: "NTF-1", taskId: "AF-1024", kind: "comment", read: false, message: "Nisha Rao commented on AF-1024: Bank reconciliation mismatch", createdAt: minutesAgo(10) },
  { id: "NTF-2", taskId: "AF-1025", kind: "status", read: false, message: "Task AF-1025: GST input credit evidence missing status changed from Open to Overdue", createdAt: minutesAgo(120) },
  { id: "NTF-3", taskId: "AF-1026", kind: "closed", read: true, message: "Task AF-1026: Payroll approval trail incomplete has been closed", createdAt: minutesAgo(60 * 26) },
  { id: "NTF-4", taskId: "AF-1027", kind: "assignment", read: true, message: "You have been assigned to task AF-1027: Vendor onboarding checklist gap", createdAt: minutesAgo(60 * 50) },
];

export function getMockNotifications(): MockNotification[] {
  return mockNotifications;
}

export function getMockUnreadCount(): number {
  return mockNotifications.filter((n) => !n.read).length;
}

export function markMockNotificationRead(notificationId?: string): void {
  if (notificationId) {
    const notification = mockNotifications.find((n) => n.id === notificationId);
    if (notification) notification.read = true;
    return;
  }
  mockNotifications.forEach((n) => { n.read = true; });
}

export function deleteMockNotification(notificationId: string): void {
  const index = mockNotifications.findIndex((n) => n.id === notificationId);
  if (index >= 0) mockNotifications.splice(index, 1);
}
