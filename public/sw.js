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

/** How long a tab that is not visible has to say it followed the push itself. */
const NAVIGATE_ACK_MS = 1500;
/*
  …and a tab that focus() has just brought into view. Its timers and message
  loop are no longer throttled, but a phone can still be busy for a moment
  after waking; timing out there reloads the tab and tears the room down,
  which is the thing this exchange exists to avoid.
*/
const NAVIGATE_ACK_VISIBLE_MS = 8000;

/*
  Ask a Square tab to navigate in-app. Resolves true once it confirms. The
  message carries the moment the fallback fires (`deadline`), and the page
  ignores a message that reaches it at or past that moment
  (lib/push-navigate.ts) — so a late answer never adds a second navigation
  on top of the worker's.
*/
function askToNavigate(client, target) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const wait = client.visibilityState === "visible" ? NAVIGATE_ACK_VISIBLE_MS : NAVIGATE_ACK_MS;
    const deadline = Date.now() + wait;
    const timer = setTimeout(() => resolve(false), wait);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data === "ok");
    };
    try {
      client.postMessage({ type: "ms:navigate", url: target.href, deadline }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });
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
          // focus() resolves to the client as it is now — visible.
          const focused = (await client.focus()) || client;
          // NOT navigate() first: that is a full page load, and a full load
          // tears down the tab's gist room — a host goes silent because
          // somebody winked back. The tab navigates itself in-app
          // (components/layout/push-navigation.tsx) and says so; only a tab
          // that does not answer is navigated the hard way.
          const acknowledged = await askToNavigate(focused, target);
          if (!acknowledged && "navigate" in client) await client.navigate(target.href);
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })()
  );
});
