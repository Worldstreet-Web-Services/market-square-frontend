/**
 * WEB PUSH — the rules for Settings' "Push notifications" row.
 *
 * Push only works when three things line up: this browser can do it, this
 * deployment has push keys (`GET /push/vapid-public-key` answers a key rather
 * than null), and the person has not blocked notifications for Square. Each
 * gap gets its own plain reason on the row instead of a switch that does
 * nothing. Pure, so `node --test` pins it.
 */

export type PushAvailability = "unsupported" | "unavailable" | "blocked" | "loading" | "ready";

export function pushAvailability(input: {
  /** This browser has a service worker, PushManager and Notification. */
  supported: boolean;
  /** `/me/settings`: still loading, answered, or not deployed / failed. */
  settingsState: "loading" | "live" | "gone";
  /** `notifications.push` — absent on a service without push. */
  pushSetting: boolean | undefined;
  /** The deployment's public key: undefined while loading, null when push is not configured. */
  publicKey: string | null | undefined;
  /** `Notification.permission`. */
  permission: string;
}): PushAvailability {
  if (!input.supported) return "unsupported";
  if (input.settingsState === "gone") return "unavailable";
  if (input.settingsState === "loading" || input.publicKey === undefined) return "loading";
  if (input.pushSetting === undefined || input.publicKey === null) return "unavailable";
  if (input.permission === "denied") return "blocked";
  return "ready";
}

export const PUSH_COPY: Record<PushAvailability, string> = {
  unsupported: "This browser can't show push notifications.",
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
