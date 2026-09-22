"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api/envelope";
import { PUSH_COPY, looksLikeIos, pushAvailability } from "@/lib/push";
import {
  fetchVapidPublicKey,
  hasPushSubscription,
  pushSupported,
  subscribeThisBrowser,
  unsubscribeThisBrowser,
} from "@/lib/push-client";
import { useSettings, useUpdateSettings } from "@/features/settings/hooks/use-settings";

/**
 * Settings → Notifications → "Push notifications".
 *
 * ON asks this browser for permission, subscribes it and records it, and saves
 * `notifications.push`. OFF forgets this browser and saves the preference off
 * (which stops pushes to every browser signed in to the account). The row is
 * checked only when the preference is on AND this browser is subscribed, so
 * it never shows a push that will not arrive here.
 */
/** Nothing to subscribe to: support and permission only change when this hook asks. */
const noSubscribe = () => () => {};

export function usePushNotifications() {
  const settings = useSettings();
  const save = useUpdateSettings();
  // Read from the browser during render — false/"default" on the server, so
  // both sides start identical and the real answer arrives right after.
  const supported = useSyncExternalStore(noSubscribe, pushSupported, () => false);
  const browserPermission = useSyncExternalStore(
    noSubscribe,
    () => (pushSupported() ? Notification.permission : "default"),
    () => "default"
  );
  // What the permission prompt just answered, until the next render reads it.
  const [answeredPermission, setAnsweredPermission] = useState<string | null>(null);
  const permission = answeredPermission ?? browserPermission;
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    void hasPushSubscription()
      .then(setSubscribed)
      .catch(() => setSubscribed(false));
  }, [supported]);

  const publicKey = useQuery({
    queryKey: ["ms", "push-public-key"],
    queryFn: fetchVapidPublicKey,
    enabled: supported,
    staleTime: Infinity,
  });

  /*
    READ FROM THE BROWSER, not from state: neither answer can change while
    this screen is open. An iPhone cannot become a desktop, and installing to
    the Home Screen opens a NEW app window rather than changing this one — so
    a subscription here would never fire, and the server render (false) has to
    match the first client render anyway.
  */
  const ios = useSyncExternalStore(
    noSubscribe,
    () =>
      looksLikeIos({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
      }),
    () => false
  );
  const standalone = useSyncExternalStore(
    noSubscribe,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari's own, older flag — the one that is actually set on an iPhone.
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false
  );

  const availability = pushAvailability({
    supported,
    ios,
    standalone,
    settingsState: settings.isSuccess ? "live" : settings.isError ? "gone" : "loading",
    pushSetting: settings.data?.notifications.push,
    publicKey: publicKey.isError ? null : publicKey.data,
    permission,
  });

  const change = async (next: boolean) => {
    if (availability !== "ready" || !publicKey.data) return;
    setBusy(true);
    try {
      if (next) {
        const allowed = await subscribeThisBrowser(publicKey.data);
        setAnsweredPermission(Notification.permission);
        if (!allowed) {
          toast.error("Allow notifications for Square in your browser to turn this on.");
          return;
        }
        setSubscribed(true);
        save.mutate({ notifications: { push: true } });
      } else {
        await unsubscribeThisBrowser();
        setSubscribed(false);
        save.mutate({ notifications: { push: false } });
      }
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't change push notifications."));
    } finally {
      setBusy(false);
    }
  };

  return {
    checked: availability === "ready" && subscribed && settings.data?.notifications.push === true,
    disabled: availability !== "ready" || busy,
    description: PUSH_COPY[availability],
    onChange: (next: boolean) => void change(next),
  };
}
