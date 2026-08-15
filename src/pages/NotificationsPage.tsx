import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../lib/apiClient";
import { getNotifications, markNotificationRead, type AppNotification, type NotificationKind } from "../services/notifications";
import { parseApiDateTime } from "../lib/dateTime";

const iconByKind: Record<NotificationKind, string> = {
  assignment: "ti-user-plus",
  status: "ti-refresh",
  comment: "ti-message",
  reopened: "ti-rotate",
  closed: "ti-circle-check",
  mention: "ti-at",
  invitation: "ti-mail",
  announcement: "ti-speakerphone",
  report: "ti-file-check",
  reminder: "ti-alarm",
};

const dotColorByKind: Record<NotificationKind, "green" | "amber" | "blue"> = {
  assignment: "blue",
  status: "amber",
  comment: "blue",
  reopened: "amber",
  closed: "green",
  mention: "blue",
  invitation: "blue",
  announcement: "amber",
  report: "green",
  reminder: "amber",
};

function isToday(iso: string) {
  const date = parseApiDateTime(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function formatRelative(iso: string) {
  const diffMs = Date.now() - parseApiDateTime(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({ queryKey: ["notifications"], queryFn: getNotifications });
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
  };
  const markReadMutation = useMutation({ mutationFn: (notificationId?: string) => markNotificationRead(notificationId), onSuccess: invalidate });

  const openNotification = (notification: AppNotification) => {
    if (!notification.isRead) markReadMutation.mutate(notification.id);
    if (notification.taskId) navigate(`/tasks/${notification.taskId}`);
  };

  if (notificationsQuery.isLoading) {
    return <div className="notifications-page"><p className="data-state">Loading notifications…</p></div>;
  }
  if (notificationsQuery.error) {
    const detail = notificationsQuery.error instanceof ApiError ? notificationsQuery.error.detail : "Couldn't load notifications.";
    return <div className="notifications-page"><p className="data-state is-error">{detail}</p></div>;
  }

  const groups: Array<{ label: "Today" | "Earlier"; items: AppNotification[] }> = [
    { label: "Today", items: notifications.filter((n) => isToday(n.createdAt)) },
    { label: "Earlier", items: notifications.filter((n) => !isToday(n.createdAt)) },
  ];

  return (
    <div className="notifications-page">
      <section className="card notification-card">
        <div className="notification-heading">
          <h2>Notifications</h2>
          <button type="button" onClick={() => markReadMutation.mutate(undefined)} disabled={!unreadCount || markReadMutation.isPending}>Mark all as read</button>
        </div>
        {groups.map((group) =>
          group.items.length ? (
            <div key={group.label}>
              <div className="notif-day">{group.label}</div>
              {group.items.map((notification) => (
                <button className={`notif-item ${notification.isRead ? "" : "unread"}`} type="button" key={notification.id} onClick={() => openNotification(notification)}>
                  <span className={`dot ${dotColorByKind[notification.kind]}`}><i className={`ti ${iconByKind[notification.kind]}`} /></span>
                  <span>
                    <span className="notification-message">{notification.message}</span>
                    <span className="when">{formatRelative(notification.createdAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null,
        )}
        {notifications.length === 0 ? <p className="data-state">No notifications yet.</p> : null}
      </section>
    </div>
  );
}
