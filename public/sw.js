// Minimal Web Push service worker. Runs independently of any open tab, as long as the browser
// process is alive - that's what lets a push notification reach the user while they're working
// in another app (Tally, Excel) with AuditFlow merely installed, not necessarily focused.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "AuditFlow", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "AuditFlow", {
      body: payload.body,
      data: { taskId: payload.taskId ?? null },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const taskId = event.notification.data?.taskId;
  const targetPath = taskId ? `/tasks/${taskId}` : "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetPath);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetPath);
    }),
  );
});
