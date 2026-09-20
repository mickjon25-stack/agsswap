/* AgsSwap — lightweight service worker for Notification API on HTTPS (GitHub Pages). */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });
      for (const client of all) {
        try {
          client.postMessage({ type: "NOTIFICATION_CLICK", ...data });
        } catch (_) {}
        if ("focus" in client) {
          await client.focus();
          return;
        }
      }
      const path = data.url || "/";
      if (self.clients.openWindow) {
        await self.clients.openWindow(path);
      }
    })()
  );
});
