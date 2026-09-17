"use client";

import { z } from "zod";
import { msApi } from "@/lib/api/service";
import { urlBase64ToUint8Array } from "@/lib/push";
import { asset } from "./square-path.ts";

/**
 * This browser's side of web push: the service worker (`public/sw.js`), the
 * browser's subscription, and the three service routes that record it.
 *
 * Every function here is safe to call anywhere — on a browser without push, or
 * before anything was subscribed, it simply does nothing.
 */

const VapidKeySchema = z.object({ publicKey: z.string().nullable() });

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** The deployment's public push key, or null where push is not configured. */
export async function fetchVapidPublicKey(): Promise<string | null> {
  return VapidKeySchema.parse(await msApi.get("/push/vapid-public-key")).publicKey;
}

async function existingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/** Whether this browser currently holds a push subscription. */
export async function hasPushSubscription(): Promise<boolean> {
  return Boolean(await existingSubscription());
}

/**
 * Ask for permission, subscribe this browser and record it. False when the
 * person does not allow notifications.
 */
export async function subscribeThisBrowser(publicKey: string): Promise<boolean> {
  if (!pushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const registration = await navigator.serviceWorker.register(asset("/sw.js"));
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  await msApi.post("/me/push-subscriptions", subscription.toJSON());
  return true;
}

/**
 * Re-record this browser's subscription — the service refreshes its keys and
 * moves it to whoever is signed in. Called on app load while permission is
 * granted; quiet on any failure.
 */
export async function refreshPushSubscription(): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const subscription = await existingSubscription();
    if (subscription) await msApi.post("/me/push-subscriptions", subscription.toJSON());
  } catch {
    /* a refresh that fails is retried on the next load */
  }
}

/**
 * Stop pushes to this browser: forget it on the service, then drop the
 * browser's subscription. Called when push is switched off and on sign-out, so
 * a shared browser never keeps receiving the last person's notifications.
 */
export async function unsubscribeThisBrowser(): Promise<void> {
  try {
    const subscription = await existingSubscription();
    if (!subscription) return;
    await msApi.del("/me/push-subscriptions", { endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => false);
  } catch {
    /* nothing subscribed, or the browser refused — nothing more to undo */
  }
}
