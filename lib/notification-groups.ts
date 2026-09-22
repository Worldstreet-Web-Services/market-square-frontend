/**
 * THE SERVICE'S BUCKETS, AND THE ONE PLACE THEY ARE NAMED.
 *
 * Every notification row carries a `group` decided by the service. The
 * notifications page filters on it, and Settings now tunes push with it.
 *
 * ─── WHY PUSH IS TUNED PER GROUP AND NOT PER KIND ────────────────────────────
 * Fifteen kinds push today, and one switch governs all of them — so a phone
 * that buzzes for a comment buzzes for a DM, and the way people fix that is by
 * revoking the notification permission in the OS, which is close to permanent
 * because nobody goes back to grant it again. Per-kind switches are the
 * obvious fix and the wrong one.
 *
 * They are wrong because a per-kind list has to be re-listed on the client,
 * and THIS REPO HAS BEEN BURNT BY THAT THREE TIMES: `tip_received`, `wink`,
 * and then four kinds at once, each missing from our enum and each rendered to
 * real people as "started following you" — a creator who had been paid was
 * told they had a new follower. A switch list has the identical hole: the day
 * the service adds kind sixteen it has no switch, so it either buzzes somebody
 * who opted out of everything like it or silently buzzes nobody. Both defaults
 * are wrong for someone and neither is visible.
 *
 * A per-GROUP switch does not have that hole. Kind sixteen lands in a bucket
 * the reader already has a switch for, on the day the service ships it, with
 * no change here and no default to guess. The kind-to-group map stays where
 * `features/notifications/lib/types.ts` says it must: on the server.
 *
 * Pure and alias-free, so `node --test` pins it.
 */

/** The service's own buckets. No `all` member: omitting the filter IS all. */
export const NOTIFICATION_GROUPS = ["social", "money", "rooms", "chat", "account"] as const;
export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

/** Our words for them — the MAPPING stays server-side. Shared so the
    notifications page and Settings cannot drift into two vocabularies. */
export const GROUP_LABEL: Record<NotificationGroup, string> = {
  social: "Social",
  money: "Money",
  rooms: "Rooms",
  chat: "Chat",
  account: "Account",
};

/**
 * Settings' order, most-wanted first, which is NOT the order the enum happens
 * to be written in. Somebody turning things off works down the list, and the
 * one they must not turn off by accident is the one they read first.
 */
export const PUSH_GROUP_ORDER: readonly NotificationGroup[] = [
  "chat",
  "rooms",
  "social",
  "money",
  "account",
];

/**
 * One line each, written as a THEME rather than a list of kinds.
 *
 * A list would be a kind-to-group map in prose — the exact thing this module
 * exists to avoid — and it would go stale silently the first time the service
 * moved one. A theme stays true when kind sixteen arrives.
 */
export const PUSH_GROUP_HINT: Record<NotificationGroup, string> = {
  chat: "Messages, chat requests and groups.",
  /*
    "INCLUDING YOUR OWN" IS NOT PADDING. This bucket does two jobs: other
    people's rooms starting, and the running of yours — being asked to speak,
    and the reminder for a room you scheduled, which the service sends to the
    host and to nobody else. So somebody silencing this to stop being woken by
    a stranger's room also silences their own room's start reminder.

    Splitting the bucket would fix that and reintroduce the per-kind problem
    this module exists to avoid, so the honest move is to say so on the row
    rather than let them find out by missing their own room.
  */
  rooms: "Rooms starting and requests to speak — including reminders for your own.",
  social: "Winks, follows, and activity on what you post.",
  money: "Tips and anything paid to you.",
  /*
    `account` is the odd one and this sentence is doing real work.

    The group holds verification and role decisions too, but NEITHER of those
    has ever pushed — they are in-app rows only. The one pushable kind in it is
    an admin broadcasting your post, which the author did not choose and cannot
    decline, because "you are the last to know" is the precise failure that
    push exists to prevent. So this row is always on, and says so.
  */
  account: "When an admin shows your post to everyone. Always on.",
};

/** The one group whose push cannot be declined — see the hint above. */
export const ALWAYS_ON_GROUP: NotificationGroup = "account";

export interface PushGroupRow {
  group: NotificationGroup;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
}

/**
 * The rows Settings draws under "Push notifications".
 *
 * EMPTY when the service does not send `pushGroups`. The rule this repo
 * follows is "disabled with the reason, never a switch that saves nothing",
 * and that is right for a control the reader can see is missing — one row with
 * one sentence. Five permanently dead rows under a working switch is not a
 * reason, it is clutter: an absent capability shows nothing, a present but
 * unusable one shows why.
 *
 * THERE IS NO PER-KEY DEFAULT, deliberately. `pushGroups` is either absent —
 * a service without this — or complete: five keys, always all five. A missing
 * key is a contract break, and `?? true` here would turn it into a switch that
 * silently reads on while the service thinks otherwise. The schema rejects a
 * partial object instead, which is the same rule the rest of `/me/settings`
 * already follows.
 */
export function pushGroupRows(input: {
  /** `notifications.pushGroups`, absent on a service without per-group push. */
  groups: Record<NotificationGroup, boolean> | undefined;
  /** `notifications.push` — the master switch for this account. */
  pushOn: boolean;
  /** Whether the master switch can be used here at all (keys, permission, install). */
  pushUsable: boolean;
}): PushGroupRow[] {
  const groups = input.groups;
  if (!groups) return [];
  // Narrowing what you receive is meaningless while you receive nothing.
  const off = !input.pushOn || !input.pushUsable;
  return PUSH_GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABEL[group],
    description: PUSH_GROUP_HINT[group],
    // The undeclinable one reads ON whatever is stored, so the row can never
    // disagree with what the phone actually does.
    checked: group === ALWAYS_ON_GROUP ? true : groups[group],
    disabled: off || group === ALWAYS_ON_GROUP,
  }));
}
