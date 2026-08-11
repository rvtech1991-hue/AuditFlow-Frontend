import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from "@microsoft/signalr";
import { API_BASE_URL } from "./config";
import { getAccessToken } from "./tokenStorage";
import { queryClient } from "./queryClient";

// The API's base URL is .../api/v1 but SignalR hubs are mapped at the host root (Program.cs:
// app.MapHub<NotificationHub>("/hubs/notifications")) — strip the API prefix to get the hub origin.
const HUB_URL = `${API_BASE_URL.replace(/\/api\/v\d+\/?$/, "")}/hubs/notifications`;

let connection: HubConnection | null = null;

export function connectNotificationHub(): void {
  if (connection) return;

  connection = new HubConnectionBuilder()
    .withUrl(HUB_URL, { accessTokenFactory: () => getAccessToken() ?? "" })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();

  connection.on("ReceiveNotification", () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    // A new notification almost always means a task changed under this user (assigned,
    // reassigned, commented, status changed) - the sidebar's Tasks badge (dashboard summary)
    // and any open Tasks list are separate cached queries that this push previously never told
    // to refresh, so they'd sit stale until an unrelated remount happened to refetch them.
    queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  });

  connection.start().catch((error) => {
    // A missed real-time push isn't fatal — Topbar's polling fallback still covers it.
    console.warn("[notificationHub] connection failed, falling back to polling", error);
  });
}

export function disconnectNotificationHub(): void {
  if (!connection) return;
  const activeConnection = connection;
  connection = null;
  if (activeConnection.state !== HubConnectionState.Disconnected) {
    void activeConnection.stop();
  }
}
