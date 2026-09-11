/**
 * WHICH "NOW FRIENDS" MOMENT TO SHOW — node 647:16628, the popup a person
 * meets on their next sign-in when somebody followed them back or winked.
 *
 * Pure, so the rule can be read and pinned without a browser. The input is
 * the person's UNREAD notifications, newest first, as the service lists them;
 * the output is the one moment worth a popup, or null.
 *
 * THREE MOMENTS, in the order the product ranks them:
 *
 *   friends       somebody the viewer already follows has followed them back
 *                 — a `follow` whose actor the viewer follows. Both faces;
 *                 "Start gisting" and "Wink at <name>".
 *   mutual-wink   somebody winked, and the viewer had already winked at them
 *                 — a `wink` whose actor carries `winkedByMe: true`. Both
 *                 faces; the button becomes "Follow back" when the viewer does
 *                 not follow them yet, else "Start gisting".
 *   wink          somebody winked, first move — a `wink` otherwise. Their
 *                 face alone; "Wink back".
 *
 * `winkedByMe` is asked of the backend and may be absent; absent is UNKNOWN,
 * never "no", but the honest reading of unknown here is the smaller claim —
 * a first wink — because "Wink back" on somebody already winked is refused by
 * the service with its own words, while "you winked each other" on a guess
 * would be a fabricated match.
 *
 * ONLY UNREAD rows qualify, and the caller marks the chosen rows read when the
 * popup closes: that is what makes it "the first time", with no new state to
 * keep anywhere.
 */
export interface FriendsMomentActor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isFollowing?: boolean;
  /** The viewer has an active wink at them (inside the cooldown). */
  winkedByMe?: boolean;
  /** They have an active wink at the viewer. A `wink` row implies it. */
  winkedMe?: boolean;
}

export interface FriendsMomentInput {
  id: string;
  kind: string;
  readAt: string | null;
  actor: FriendsMomentActor | null;
}

export type FriendsMomentKind = "friends" | "mutual-wink" | "wink";

export interface FriendsMoment {
  kind: FriendsMomentKind;
  actor: FriendsMomentActor;
  /** Every unread row about this actor of the same family, to mark read together. */
  notificationIds: string[];
}

/** What one unread row is worth, or null when it is not a moment at all. */
function momentKindOf(row: FriendsMomentInput): FriendsMomentKind | null {
  if (row.kind === "follow") return row.actor!.isFollowing === true ? "friends" : null;
  if (row.kind === "wink") return row.actor!.winkedByMe === true ? "mutual-wink" : "wink";
  return null;
}

const RANK: Record<FriendsMomentKind, number> = { friends: 0, "mutual-wink": 1, wink: 2 };

/**
 * EVERY moment worth showing, ONE PER PERSON, best first — the fan.
 *
 * A person can be in the list more than once (a follow and a wink, or two
 * follows); they get one card, carrying their best moment and every unread
 * row of that family, so closing the card reads them all. Between people the
 * order is friends, then mutual winks, then first winks, and within a rank
 * the service's own order (newest first).
 */
export function pickFriendsMoments(notifications: FriendsMomentInput[]): FriendsMoment[] {
  const unread = notifications.filter((n) => n.readAt === null && n.actor !== null);
  const byPerson = new Map<string, FriendsMoment>();
  for (const row of unread) {
    const kind = momentKindOf(row);
    if (!kind) continue;
    const actor = row.actor!;
    const family = kind === "friends" ? ["follow"] : ["wink"];
    const ids = unread
      .filter((n) => n.actor!.id === actor.id && family.includes(n.kind))
      .map((n) => n.id);
    const held = byPerson.get(actor.id);
    if (!held || RANK[kind] < RANK[held.kind]) byPerson.set(actor.id, { kind, actor, notificationIds: ids });
  }
  return [...byPerson.values()].sort((a, b) => RANK[a.kind] - RANK[b.kind]);
}

/** The one moment to lead with — the front of the fan. */
export function pickFriendsMoment(notifications: FriendsMomentInput[]): FriendsMoment | null {
  return pickFriendsMoments(notifications)[0] ?? null;
}

export interface FriendsMomentCopy {
  /** The two lines, each as [bright, dim, bright, dim…] runs the way the file styles them. */
  headline: { text: string; dim: boolean }[];
  subline: { text: string; dim: boolean }[];
  primary: "start-gisting" | "wink-back" | "follow-back";
  secondary: "wink" | "start-gisting" | null;
  /** Both faces, or the other person's alone. */
  faces: "both" | "theirs";
}

/** The words and buttons for a moment. `name` is the other person's display name. */
export function friendsMomentCopy(moment: FriendsMoment, name: string): FriendsMomentCopy {
  switch (moment.kind) {
    case "friends":
      // 647:16649, run for run: "You" bright, "and" dim, the name bright,
      // "are now friends now!" dim; "Start gisting" bright, "or later" dim.
      return {
        headline: [
          { text: "You ", dim: false },
          { text: "and", dim: true },
          { text: ` ${name} `, dim: false },
          { text: "are now friends now!", dim: true },
        ],
        subline: [
          { text: "Start gisting", dim: false },
          { text: " or later", dim: true },
        ],
        primary: "start-gisting",
        secondary: "wink",
        faces: "both",
      };
    case "mutual-wink":
      return {
        headline: [
          { text: "You ", dim: false },
          { text: "and", dim: true },
          { text: ` ${name} `, dim: false },
          { text: "winked at each other!", dim: true },
        ],
        subline: [
          { text: moment.actor.isFollowing ? "Start gisting" : "Follow back", dim: false },
          { text: " or later", dim: true },
        ],
        primary: moment.actor.isFollowing ? "start-gisting" : "follow-back",
        secondary: moment.actor.isFollowing ? null : "start-gisting",
        faces: "both",
      };
    case "wink":
      return {
        headline: [
          { text: name, dim: false },
          { text: " winked at you!", dim: true },
        ],
        subline: [
          { text: "Wink back", dim: false },
          { text: " or later", dim: true },
        ],
        primary: "wink-back",
        secondary: "start-gisting",
        faces: "theirs",
      };
  }
}

/**
 * The buttons' words for a moment's copy. Shared by the popup and the saved
 * card (`lib/wink-card`), so the picture can never label a button differently
 * from the one on screen.
 */
export function friendsMomentLabels(
  copy: FriendsMomentCopy,
  name: string
): { primary: string; secondary: string | null } {
  const primary =
    copy.primary === "start-gisting" ? "Start gisting" : copy.primary === "wink-back" ? "Wink back" : "Follow back";
  const secondary =
    copy.secondary === "wink" ? `Wink at ${name}` : copy.secondary === "start-gisting" ? "Start gisting" : null;
  return { primary, secondary };
}

/**
 * The caption a moment's card goes out with when it is posted to Square.
 *
 * Written in the poster's own voice, since it is their post now, and naming the
 * other person by HANDLE so the caption links to them. A prefill only: the
 * composer opens with it and the poster can change or delete every word.
 */
export function friendsMomentCaption(moment: FriendsMoment): string {
  const handle = `@${moment.actor.username}`;
  switch (moment.kind) {
    case "friends":
      return `${handle} and I are now friends on Square 💜`;
    case "mutual-wink":
      return `${handle} and I winked at each other on Square 😉`;
    case "wink":
      return `${handle} winked at me on Square 😉`;
  }
}
