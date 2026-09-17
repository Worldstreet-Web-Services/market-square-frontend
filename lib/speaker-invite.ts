/**
 * INVITE TO SPEAK — the rules, with no React, no clock and no network in them.
 *
 * The host asks a listener up; the listener says yes or not now. Everything a
 * surface has to decide about that handshake is here so `lib/speaker-invite.test.ts`
 * can pin it: whether the host's control is offered and why it is disabled,
 * what the invitee's banner shows from the row the server returned, what the
 * host is told when an invitation ends without anyone taking a seat, and which
 * error answer means "this is not deployed yet" rather than "no".
 *
 * Three rules the product owner fixed (2026-09-17) and this module holds:
 *
 *  1. CONSENT. An invitation never seats anybody. It is a banner the invitee
 *     answers, and accepting it seats them with the mic OFF (lib/mic-consent.ts
 *     never auto-enables on `inviteAccept`).
 *  2. THE HOST IS NEVER TOLD "DECLINED". A refusal and an invitation that ran
 *     out read the same: "<name> isn't available to speak right now".
 *  3. THE CLOCK IS THE SERVER'S. The countdown is read from `expiresAt`; the
 *     client never starts its own 60 seconds.
 */

import { squarePaths } from "./square-path.ts";

/** Anonymous listeners join as `anon-<id>`; the service refuses to invite them. */
export function isAnonymousIdentity(identity: string): boolean {
  const base = identity.split("#")[0] ?? identity;
  return base.startsWith("anon-");
}

/** `0:42`, `1:05`. Never negative. */
export function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ *
 * The invitee's banner
 * ------------------------------------------------------------------ */

/** The part of a speaker-request row the banner reads. */
export interface InviteRow {
  id: string;
  status: string;
  expiresAt: string | null;
}

export type InviteView =
  | { state: "none" }
  | { state: "expired"; requestId: string }
  | {
      state: "open";
      requestId: string;
      /** Whole seconds left, or null when the server sent no expiry. */
      secondsLeft: number | null;
    };

/**
 * What the invitee sees for their own row at `now` (epoch ms).
 *
 * Only `invited` is an invitation. An expiry that has passed is `expired`,
 * which draws nothing — the lazy expiry on the server will turn the row into
 * `withdrawn` on the next read, and the banner must not hang on at 0:00 until
 * it does. A row with no parseable expiry is still an open invitation (the
 * server owns the timeout either way); it simply has no countdown.
 */
export function inviteView(row: InviteRow | null | undefined, now: number): InviteView {
  if (!row || row.status !== "invited") return { state: "none" };
  const expires = row.expiresAt ? Date.parse(row.expiresAt) : Number.NaN;
  if (!Number.isFinite(expires)) return { state: "open", requestId: row.id, secondsLeft: null };
  const left = Math.ceil((expires - now) / 1000);
  if (left <= 0) return { state: "expired", requestId: row.id };
  return { state: "open", requestId: row.id, secondsLeft: left };
}

/**
 * Is the shell's banner (the mini-player's) drawn?
 *
 * The room's own page draws the banner inside the room, so the shell's stays
 * away there — two "Join as speaker" buttons for one invitation is a question
 * asked twice. Everywhere else in the Square, with the room minimised, the
 * invitation has to reach the reader, or a host's 60 seconds run out on a
 * reader who is reading their DMs.
 */
export function inviteBannerVisible(input: {
  pathname: string;
  streamId: string | null;
  hasInvite: boolean;
}): boolean {
  if (!input.hasInvite || !input.streamId) return false;
  return logicalPath(input.pathname) !== `/gist-rooms/${input.streamId}`;
}

/** Both spellings of a route — standalone `/x` and Ark's `/square/x` — as one. */
const logicalPath = squarePaths("/square").stripSquare;

/** Said once to a screen reader when the banner appears. It promises nothing about a seat or a mic. */
export function inviteAnnouncement(hostName: string | null | undefined): string {
  const who = hostName?.trim();
  return `${who || "The host"} invited you to speak.`;
}

/** The one-time hint once an accepted invitation has seated them: the mic is theirs to open. */
export const INVITE_ACCEPTED_HINT = "You're on the stage with your mic off. Tap the mic when you're ready to talk.";

/**
 * What leaving the room does to the reader's own row.
 *
 * A seat or a raised hand comes down with `leave`, as it always has. An
 * invitation still waiting on an answer is answered `reject` — walking out is
 * an answer, and the host is told the same neutral line as any other. Anything
 * else has nothing to release.
 */
export function releaseActionFor(status: string | null | undefined): "leave" | "reject" | null {
  if (status === "approved" || status === "pending") return "leave";
  if (status === "invited") return "reject";
  return null;
}

/* ------------------------------------------------------------------ *
 * The host's control
 * ------------------------------------------------------------------ */

export interface InviteTarget {
  /** The LiveKit identity (`<did>`, `<did>#speaker`, `anon-…`). */
  identity: string;
  /** On a seat already. */
  seated: boolean;
  /** Their own raised hand, if any. */
  pendingRequestId: string | null;
  /** An invitation of ours they have not answered yet. */
  openInviteId: string | null;
}

export type InviteControl =
  | { kind: "hidden" }
  /** They already asked: the host's answer is to seat them, not to invite. */
  | { kind: "seat"; requestId: string }
  /** Waiting on them. The host may take it back. */
  | { kind: "invited"; requestId: string }
  | { kind: "invite"; disabled: false }
  | { kind: "invite"; disabled: true; reason: string };

export function inviteControl(input: {
  viewerIsHost: boolean;
  /** The target is the viewer. */
  isSelf: boolean;
  target: InviteTarget;
  stageFull: boolean;
  seatCount: number;
  /** The invite route answered "not deployed" this page load. */
  unavailable: boolean;
  /** The service refused this person as banned or blocked. */
  refused: boolean;
  /** Epoch ms until which the service said "not yet", or null. */
  cooldownUntil: number | null;
  now: number;
}): InviteControl {
  const { target } = input;
  if (!input.viewerIsHost || input.isSelf || target.seated) return { kind: "hidden" };
  // A raised hand is the existing flow and works without the new routes.
  if (target.pendingRequestId) return { kind: "seat", requestId: target.pendingRequestId };
  if (input.unavailable) return { kind: "hidden" };
  // Hidden, not disabled: a greyed "Invite" on somebody who blocked you tells
  // the host something the person chose not to say.
  if (input.refused) return { kind: "hidden" };
  if (target.openInviteId) return { kind: "invited", requestId: target.openInviteId };
  if (isAnonymousIdentity(target.identity)) {
    return { kind: "invite", disabled: true, reason: "They're listening without an account, so they can't be invited to speak." };
  }
  if (input.stageFull) {
    return { kind: "invite", disabled: true, reason: `All ${input.seatCount} seats are taken. Move someone down first.` };
  }
  if (input.cooldownUntil !== null && input.cooldownUntil > input.now) {
    const left = formatCountdown((input.cooldownUntil - input.now) / 1000);
    return { kind: "invite", disabled: true, reason: `You can invite them again in ${left}.` };
  }
  return { kind: "invite", disabled: false };
}

/**
 * The host's open invitations by person, keyed on the BARE user id — an
 * identity in the room may carry `#speaker`, a row's `userId` never should,
 * and comparing the two raw is a bug this codebase has fixed before.
 */
export function invitesByUser<T extends { userId: string; status: string }>(rows: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (row.status !== "invited") continue;
    map.set(row.userId.split("#")[0] ?? row.userId, row);
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * The host's outcome
 * ------------------------------------------------------------------ */

/** One and the same sentence for a refusal and a lapse. Never "declined". */
export function hostOutcomeLabel(name: string | null | undefined): string {
  const who = name?.trim();
  return who ? `${who} isn't available to speak right now` : "They aren't available to speak right now";
}

export interface TrackedInvite {
  id: string;
  userId: string;
  name: string;
  /** When the row stopped being listed as invited, or null while it is. */
  goneAt: number | null;
}

/**
 * How long a vanished invitation waits to see its invitee seated before the
 * host is told they are not coming. The invited list, the request list and the
 * LiveKit grant all arrive separately; an accept seen in one before the other
 * must not read as a refusal.
 */
export const OUTCOME_GRACE_MS = 6_000;

/**
 * Follow the host's invitations from one read to the next.
 *
 * An invitation that leaves the invited list is SETTLED by what happened to
 * its invitee, never by the status on a row: seated (a grant, or an approved
 * row) is an acceptance and says nothing; taken back by the host says
 * nothing; anything else, once the grace has passed, is "isn't available".
 */
export function settleInvites(
  tracked: readonly TrackedInvite[],
  input: {
    open: readonly { id: string; userId: string; name: string }[];
    seatedUserIds: ReadonlySet<string>;
    cancelledIds: ReadonlySet<string>;
    now: number;
    graceMs?: number;
  }
): { tracked: TrackedInvite[]; unavailable: TrackedInvite[] } {
  const grace = input.graceMs ?? OUTCOME_GRACE_MS;
  const openIds = new Map(input.open.map((item) => [item.id, item]));
  const next: TrackedInvite[] = [];
  const unavailable: TrackedInvite[] = [];
  const seen = new Set<string>();
  for (const invite of tracked) {
    seen.add(invite.id);
    const still = openIds.get(invite.id);
    if (still) {
      next.push({ ...invite, name: still.name || invite.name, goneAt: null });
      continue;
    }
    if (input.cancelledIds.has(invite.id)) continue;
    if (input.seatedUserIds.has(invite.userId)) continue;
    if (invite.goneAt === null) {
      next.push({ ...invite, goneAt: input.now });
      continue;
    }
    if (input.now - invite.goneAt >= grace) unavailable.push(invite);
    else next.push(invite);
  }
  for (const item of input.open) {
    if (!seen.has(item.id)) next.push({ id: item.id, userId: item.userId, name: item.name, goneAt: null });
  }
  return { tracked: next, unavailable };
}

/* ------------------------------------------------------------------ *
 * Error answers
 * ------------------------------------------------------------------ */

export interface ApiErrorLike {
  code?: string | null;
  status?: number;
  details?: unknown;
}

/**
 * Did this call reach a route that is not deployed?
 *
 * The service answers `NOT_FOUND` for everything, and says what was missing in
 * `details.resource` only when an ENTITY was — so a 404 without it is a route
 * that does not exist. Before invite ships, the existing action route and the
 * list's `status` filter refuse the new values with a VALIDATION_ERROR naming
 * `action` or `status`; that is the same answer in a different shape.
 */
export function routeMissing(error: ApiErrorLike | null | undefined): boolean {
  if (!error) return false;
  const details = error.details as { resource?: unknown } | unknown[] | null | undefined;
  if (error.code === "NOT_FOUND") {
    return !(details && !Array.isArray(details) && typeof details === "object" && "resource" in details);
  }
  if (error.code === "VALIDATION_ERROR" && Array.isArray(details)) {
    return details.some((detail) => {
      const path = (detail as { path?: unknown } | null)?.path;
      const name = Array.isArray(path) ? path[path.length - 1] : path;
      return name === "action" || name === "status";
    });
  }
  return false;
}

export type InviteErrorOutcome =
  /** Not deployed: hide the control, say nothing. */
  | { kind: "unavailable" }
  /** Banned or blocked: hide the control for this person, say nothing more than a neutral line. */
  | { kind: "refused"; message: string }
  /** Try again later: disable with a countdown. */
  | { kind: "cooldown"; message: string; retryAfterSeconds: number }
  | { kind: "message"; message: string };

function retryAfter(details: unknown): number | null {
  const value = (details as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** What the host is told when an invitation could not be sent. */
export function inviteErrorOutcome(error: ApiErrorLike | null | undefined, name?: string | null): InviteErrorOutcome {
  if (routeMissing(error)) return { kind: "unavailable" };
  const who = name?.trim() || "They";
  switch (error?.code) {
    case "STREAM_NOT_LIVE":
      return { kind: "message", message: "The gist room isn't live." };
    case "CANNOT_INVITE_SELF":
      return { kind: "message", message: "You're already on the stage." };
    case "NOT_FOUND":
      return { kind: "message", message: `${who} can't be invited to this room.` };
    case "SPEAKER_BANNED":
    case "BLOCKED":
      return { kind: "refused", message: `${who} can't be invited to speak.` };
    case "NOT_IN_ROOM":
      return { kind: "message", message: `${who} isn't in the room any more.` };
    case "ALREADY_SPEAKER":
      return { kind: "message", message: `${who} is already on the stage.` };
    case "STAGE_FULL":
      return { kind: "message", message: "Every seat is taken. Move someone down first." };
    case "INVITE_COOLDOWN": {
      const seconds = retryAfter(error.details) ?? 60;
      return {
        kind: "cooldown",
        retryAfterSeconds: seconds,
        message: `You can invite ${who === "They" ? "them" : who} again in ${formatCountdown(seconds)}.`,
      };
    }
    case "RATE_LIMITED": {
      const seconds = retryAfter(error.details);
      return {
        kind: "message",
        message: seconds ? `Too many invitations. Try again in ${formatCountdown(seconds)}.` : "Too many invitations. Try again in a moment.",
      };
    }
    default:
      return { kind: "message", message: "Couldn't send the invitation." };
  }
}

/** What the invitee is told when answering could not go through. */
export function answerErrorMessage(error: ApiErrorLike | null | undefined): string | null {
  switch (error?.code) {
    case "INVITE_NOT_OPEN":
      return "That invitation has ended.";
    case "STAGE_FULL":
      return "The stage filled up before you could join.";
    case "STREAM_NOT_LIVE":
      return "The gist room isn't live any more.";
    default:
      return routeMissing(error) ? null : "Couldn't answer the invitation.";
  }
}
