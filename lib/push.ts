/**
 * WEB PUSH — the rules for Settings' "Push notifications" row.
 *
 * Push only works when three things line up: this browser can do it, this
 * deployment has push keys (`GET /push/vapid-public-key` answers a key rather
 * than null), and the person has not blocked notifications for Square. Each
 * gap gets its own plain reason on the row instead of a switch that does
 * nothing. Pure, so `node --test` pins it.
 */

export type PushAvailability =
  | "unsupported"
  | "needs-install"
  | "unavailable"
  | "blocked"
  | "loading"
  | "ready";

/**
 * Is this an iPhone or iPad that has to install the app before it can be
 * asked about notifications?
 *
 * On iOS, and ONLY on iOS, web push is delivered to a Home Screen app and
 * never to a Safari tab — `PushManager` is not even defined in the tab, so
 * this looks exactly like a browser that cannot do push at all. Telling that
 * reader "this browser can't show push notifications" is both untrue and a
 * dead end: their phone can, and the one step that unlocks it is the one we
 * would not be mentioning.
 *
 * `standalone` is what tells the two apart — once installed, the same device
 * reports a PushManager and never reaches this branch.
 *
 * iPadOS reports itself as a Mac, hence the touch-points clause; a desktop
 * Safari has `maxTouchPoints` 0. Getting this wrong in the false direction
 * costs a Mac user one inapplicable sentence, and in the true direction costs
 * every iPhone the feature, so it leans towards saying yes.
 */
export function looksLikeIos(input: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): boolean {
  if (/iPhone|iPad|iPod/.test(input.userAgent)) return true;
  return input.platform === "MacIntel" && input.maxTouchPoints > 1;
}

export function pushAvailability(input: {
  /** This browser has a service worker, PushManager and Notification. */
  supported: boolean;
  /** An iOS device — see `looksLikeIos`. */
  ios?: boolean;
  /** Running as an installed app rather than in a browser tab. */
  standalone?: boolean;
  /** `/me/settings`: still loading, answered, or not deployed / failed. */
  settingsState: "loading" | "live" | "gone";
  /** `notifications.push` — absent on a service without push. */
  pushSetting: boolean | undefined;
  /** The deployment's public key: undefined while loading, null when push is not configured. */
  publicKey: string | null | undefined;
  /** `Notification.permission`. */
  permission: string;
}): PushAvailability {
  // BEFORE "unsupported", because on iOS the two are indistinguishable from
  // the browser's own answer and only one of them is true.
  if (!input.supported && input.ios && !input.standalone) return "needs-install";
  if (!input.supported) return "unsupported";
  if (input.settingsState === "gone") return "unavailable";
  if (input.settingsState === "loading" || input.publicKey === undefined) return "loading";
  if (input.pushSetting === undefined || input.publicKey === null) return "unavailable";
  if (input.permission === "denied") return "blocked";
  return "ready";
}

export const PUSH_COPY: Record<PushAvailability, string> = {
  unsupported: "This browser can't show push notifications.",
  /*
    THE ONLY ROW HERE THAT ASKS FOR SOMETHING. Every other reason is a state
    the reader cannot change from this screen; this one is two taps away, so it
    names them in the order Safari presents them and does not explain why.
  */
  "needs-install":
    "On iPhone, add Square to your Home Screen first — Share, then Add to Home Screen. Open it from there and turn this on.",
  unavailable: "Push notifications aren't available here yet.",
  blocked: "Notifications are blocked for Square in this browser's settings.",
  loading: "Checking this browser…",
  ready: "Get notified on this device when something happens on Square.",
};

/** A VAPID public key (URL-safe base64) as the bytes `pushManager.subscribe` takes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normal);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
