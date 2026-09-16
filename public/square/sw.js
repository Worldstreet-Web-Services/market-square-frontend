/*
  Square's service worker. It does two things and nothing else — no caching,
  no offline pages:

    · shows a web push notification, with the words the Notifications screen
      uses for that kind (the service sends them) and the Square icon;
    · opens what a tapped notification points at, reusing a Square tab when
      one is open.

  The service sends `{ notificationId, kind, title, body, url, tag }`. `url` is
  a path; it is resolved against this origin and never allowed to leave it.
  `tag` makes a repeat about the same thing replace the earlier notification.
*/

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Square";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag: typeof data.tag === "string" && data.tag ? data.tag : undefined,
      icon: "/apple-icon.png",
      badge: "/apple-icon.png",
      data: { url: typeof data.url === "string" ? data.url : "/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target;
  try {
    target = new URL((event.notification.data && event.notification.data.url) || "/notifications", self.location.origin);
  } catch {
    target = new URL("/notifications", self.location.origin);
  }
  // A push can only ever open a page on Square itself.
  if (target.origin !== self.location.origin) target = new URL("/notifications", self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target.href);
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })()
  );
});
