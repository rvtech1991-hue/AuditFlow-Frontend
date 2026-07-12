import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

type Notification = { id: string; taskId: string; day: "Today" | "Earlier"; kind: "comment" | "status" | "closed" | "assignment"; read: boolean; message: ReactNode; when: string };

const initialNotifications: Notification[] = [
  { id: "n1", taskId: "AF-1024", day: "Today", kind: "comment", read: false, message: <><b>Nisha Rao</b> commented on <b>AF-1024</b></>, when: "10 minutes ago" },
  { id: "n2", taskId: "AF-1025", day: "Today", kind: "status", read: false, message: <><b>AF-1025</b> status changed to <b>Overdue</b></>, when: "2 hours ago" },
  { id: "n3", taskId: "AF-1026", day: "Earlier", kind: "closed", read: true, message: <><b>AF-1026</b> was closed by Rakesh Kumar</>, when: "Yesterday" },
  { id: "n4", taskId: "AF-1027", day: "Earlier", kind: "assignment", read: true, message: <>You were assigned to <b>AF-1027</b></>, when: "2 days ago" },
];

const iconByKind = { comment: "ti-message", status: "ti-refresh", closed: "ti-circle-check", assignment: "ti-user-plus" };

export function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const syncCount = (count: number) => { window.localStorage.setItem("auditflow-unread-notifications", String(count)); window.dispatchEvent(new Event("auditflow-notifications-read")); };
  const markAllRead = () => { setNotifications((items) => items.map((item) => ({ ...item, read: true }))); syncCount(0); };
  const openNotification = (notification: Notification) => {
    if (!notification.read) { setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: true } : item)); syncCount(unreadCount - 1); }
    navigate(`/tasks/${notification.taskId}`);
  };

  return <div className="notifications-page"><section className="card notification-card"><div className="notification-heading"><h2>Notifications</h2><button type="button" onClick={markAllRead} disabled={!unreadCount}>Mark all as read</button></div>{(["Today", "Earlier"] as const).map((day) => <div key={day}><div className="notif-day">{day}</div>{notifications.filter((notification) => notification.day === day).map((notification) => <button className={`notif-item ${notification.read ? "" : "unread"}`} type="button" key={notification.id} onClick={() => openNotification(notification)}><span className={`dot ${notification.kind === "closed" ? "green" : notification.kind === "status" ? "amber" : "blue"}`}><i className={`ti ${iconByKind[notification.kind]}`} /></span><span><span className="notification-message">{notification.message}</span><span className="when">{notification.when}</span></span></button>)}</div>)}</section></div>;
}
