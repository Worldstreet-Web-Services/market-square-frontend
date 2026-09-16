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

  TWO BUILDS, ONE WORKER. On square.tsionark.com the Square owns the whole
  origin; inside Ark it lives under /square (www.tsionark.com/square), beside
  WSWS. The worker cannot read the build's variable and does not need to: it is
  registered from `<base>/sw.js` with no explicit scope, so its scope IS the
  base, `/` standalone and `/square/` inside Ark. `SQUARE` is that scope without
  its trailing slash: "" or "/square".

  The service sends root paths like `/p/<id>`. Inside Ark that path belongs to
  WSWS, so `underSquare` puts every path under the prefix. It mirrors `sq` in
  lib/square-path.ts, which a worker cannot import, is idempotent, and does
  nothing standalone.
*/

const SQUARE = new URL(self.registration.scope).pathname.replace(/\/$/, "");

/** A same-origin URL, moved under the prefix if it is not there already. */
function underSquare(url) {
  if (SQUARE && url.pathname !== SQUARE && !url.pathname.startsWith(SQUARE + "/")) {
    url.pathname = SQUARE + (url.pathname === "/" ? "" : url.pathname);
  }
  return url;
}

/** Is this window one of the Square's own pages, rather than a WSWS page on the same origin? */
function isSquarePage(href) {
  if (!SQUARE) return true;
  const path = new URL(href).pathname;
  return path === SQUARE || path.startsWith(SQUARE + "/");
}

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
      icon: SQUARE + "/apple-icon.png",
      badge: SQUARE + "/apple-icon.png",
      data: { url: typeof data.url === "string" ? data.url : SQUARE + "/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target;
  try {
    target = new URL((event.notification.data && event.notification.data.url) || SQUARE + "/notifications", self.location.origin);
  } catch {
    target = new URL(SQUARE + "/notifications", self.location.origin);
  }
  // A push can only ever open a page on Square itself.
  if (target.origin !== self.location.origin) target = new URL(SQUARE + "/notifications", self.location.origin);
  target = underSquare(target);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        // Only a Square tab. `includeUncontrolled` also returns WSWS's own pages on
        // www.tsionark.com, and navigating one of those away would hijack somebody's
        // portfolio tab to open a notification.
        if (new URL(client.url).origin === self.location.origin && isSquarePage(client.url) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target.href);
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })()
  );
});
