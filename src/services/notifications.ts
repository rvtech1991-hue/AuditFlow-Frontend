import { apiClient, type PagedResult } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import {
  deleteMockNotification,
  getMockNotifications,
  getMockUnreadCount,
  markMockNotificationRead,
  type NotificationKind,
} from "../mock-data/notifications";

export type { NotificationKind };

export type AppNotification = {
  id: string;
  taskId?: string;
  kind: NotificationKind;
  isRead: boolean;
  message: string;
  createdAt: string;
};

export type NotificationPreferences = {
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  dailyDigestEnabled: boolean;
};

// NotificationType enum values, confirmed against the backend source
// (src/AuditFlow.Domain/Common/Enums.cs) — matches BACKEND_INTEGRATION_GUIDE SS8.
const KIND_FROM_ENUM: Record<number, NotificationKind> = {
  1: "assignment",
  2: "status",
  3: "comment",
  4: "reopened",
  5: "closed",
  6: "mention",
  7: "invitation",
  8: "announcement",
  9: "report",
};

type RawNotification = {
  id: string;
  title: string;
  message: string | null;
  type: number;
  taskId: string | null;
  isRead: boolean;
  createdAt: string;
};

function mapNotification(raw: RawNotification): AppNotification {
  return {
    id: raw.id,
    taskId: raw.taskId ?? undefined,
    kind: KIND_FROM_ENUM[raw.type] ?? "announcement",
    isRead: raw.isRead,
    message: raw.message ?? raw.title,
    createdAt: raw.createdAt,
  };
}

function mapMock(notification: ReturnType<typeof getMockNotifications>[number]): AppNotification {
  return { id: notification.id, taskId: notification.taskId, kind: notification.kind, isRead: notification.read, message: notification.message, createdAt: notification.createdAt };
}

export async function getNotifications(): Promise<AppNotification[]> {
  if (API_MODE === "mock") return getMockNotifications().map(mapMock);
  const data = await apiClient.get<PagedResult<RawNotification>>("/notifications", { pageSize: 50 });
  return data.items.map(mapNotification);
}

export async function getUnreadCount(): Promise<number> {
  if (API_MODE === "mock") return getMockUnreadCount();
  return apiClient.get<number>("/notifications/unread-count");
}

export async function markNotificationRead(notificationId?: string): Promise<void> {
  if (API_MODE === "mock") {
    markMockNotificationRead(notificationId);
    return;
  }
  await apiClient.patch<void>("/notifications/mark-read", notificationId ? { notificationId } : {});
}

export async function deleteNotification(notificationId: string): Promise<void> {
  if (API_MODE === "mock") {
    deleteMockNotification(notificationId);
    return;
  }
  await apiClient.delete<void>(`/notifications/${notificationId}`);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  if (API_MODE === "mock") {
    const saved = window.localStorage.getItem("auditflow-notification-preferences");
    if (saved) {
      const parsed = JSON.parse(saved) as { email: boolean; inApp: boolean; digest: boolean };
      return { emailNotificationsEnabled: parsed.email, inAppNotificationsEnabled: parsed.inApp, dailyDigestEnabled: parsed.digest };
    }
    return { emailNotificationsEnabled: true, inAppNotificationsEnabled: true, dailyDigestEnabled: false };
  }
  return apiClient.get<NotificationPreferences>("/notifications/preferences");
}

export async function updateNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  if (API_MODE === "mock") {
    window.localStorage.setItem(
      "auditflow-notification-preferences",
      JSON.stringify({ email: preferences.emailNotificationsEnabled, inApp: preferences.inAppNotificationsEnabled, digest: preferences.dailyDigestEnabled }),
    );
    return;
  }
  await apiClient.patch<void>("/notifications/preferences", preferences);
}
