/* Além HQ — service worker: só notificações push (sem cache offline). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Além HQ", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Além HQ";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.id || undefined,
    data: { url: data.url || "/inicio", id: data.id || null },
  };

  const tasks = [self.registration.showNotification(title, options)];
  if (typeof data.unread === "number" && self.navigator && "setAppBadge" in self.navigator) {
    tasks.push(data.unread > 0 ? self.navigator.setAppBadge(data.unread) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(tasks).catch(() => undefined));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/inicio", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((focused) => (focused && "navigate" in focused ? focused.navigate(target) : undefined));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
