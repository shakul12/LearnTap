// LearnTap service worker: web push for teacher notifications.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // non-JSON payload; show a generic notification
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "LearnTap", {
      body: data.body || "A student needs help right now.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/teacher" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/teacher";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const existing = tabs.find((t) => t.url.includes("/teacher"));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
