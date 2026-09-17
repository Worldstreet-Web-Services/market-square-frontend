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
 *  3. THE CLOCK IS THE SERVER'S. The countdown is read from `inviteExpiresAt`
 *     (never `expiresAt`, which on the same row is the join token's expiry),
 *     moved onto the device by the server's own clock (lib/server-clock.ts).
 */

import { squarePaths } from "./square-path.ts";

/** Anonymous listeners join as `anon-<id>`; the service refuses to invite them. */
export function isAnonymousIdentity(identity: string): boolean {
  const base = identity.split("#")[0] ?? identity;
  return base.startsWith("anon-");
}

/**
 * What the host's block gate looks a person up by: their handle when the room
 * token carries one, otherwise their account id — the plain DID off the
 * LiveKit identity, which `GET /profiles/:handle` also resolves (username
 * first, then id). Keyed on the handle alone, a person whose token carried no
 * username was never checked, and a host who had blocked them was still
 * offered Invite to speak. Null only for an anonymous listener, who cannot be
 * invited anyway (the control says why) and has no profile to look at.
 */
export function inviteGateHandle(username: string | null | undefined, identity: string): string | null {
  if (username) return username;
  if (isAnonymousIdentity(identity)) return null;
  const base = identity.split("#")[0] ?? identity;
  return base.length > 0 ? base : null;
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
  inviteExpiresAt: string | null;
  /** When the server opened the row, on the server's clock. */
  createdAt?: string | null;
}

export type InviteView =
  | { state: "none" }
  | { state: "expired"; requestId: string }
  | {
      state: "open";
      requestId: string;
      /** Whole seconds left, or null when there is no countdown we can trust. */
      secondsLeft: number | null;
    };

/** The contract's lifetime of an invitation. The server owns it; this only caps a reading. */
export const INVITE_TTL_MS = 60_000;

/**
 * When an invitation stops being answerable, on THIS device's clock, or null
 * when nothing trustworthy says.
 *
 * `inviteExpiresAt` is the SERVER's clock and the device's may be minutes off,
 * so it is never read against `Date.now()` raw — a phone running 45 s fast hid
 * an invitation the server held open for 45 s more. In order:
 *
 *  1. With the server's clock (`offsetMs`, lib/server-clock.ts): the expiry
 *     moved onto this device's clock. It may already be past — a row the
 *     server lists but has not lazily withdrawn yet is over, not open.
 *  2. Without it, the row's own lifetime (`inviteExpiresAt - createdAt`, both
 *     server readings) counted from when this device first saw it. It can only
 *     run long (by the poll's delay), never short.
 *  3. Neither: null. The view holds it open without a countdown for the
 *     contract's 60 seconds from first sight, which is also never short.
 *
 * Capped at first sight + 60 s: the row was seen after it was created.
 */
export function inviteDeadline(
  inviteExpiresAt: string | null | undefined,
  firstSeenAt: number,
  clock: { offsetMs?: number | null; createdAt?: string | null; ttlMs?: number } = {}
): number | null {
  const ttl = clock.ttlMs ?? INVITE_TTL_MS;
  const expires = inviteExpiresAt ? Date.parse(inviteExpiresAt) : Number.NaN;
  if (!Number.isFinite(expires)) return null;
  const cap = firstSeenAt + ttl;
  if (typeof clock.offsetMs === "number" && Number.isFinite(clock.offsetMs)) {
    return Math.min(expires - clock.offsetMs, cap);
  }
  const created = clock.createdAt ? Date.parse(clock.createdAt) : Number.NaN;
  if (Number.isFinite(created) && expires > created) return Math.min(firstSeenAt + (expires - created), cap);
  return null;
}

/**
 * What the invitee sees for their own row at `now` (epoch ms), first seen at
 * `firstSeenAt`, with the server's clock offset when one has been read (see
 * `inviteDeadline`).
 *
 * Only `invited` is an invitation. Past the deadline it is `expired`, which
 * draws nothing rather than hanging on at 0:00 until the next poll. A row with
 * no trustworthy deadline is open without a countdown, and ends after the
 * contract's 60 seconds from first sight all the same.
 */
export function inviteView(
  row: InviteRow | null | undefined,
  now: number,
  firstSeenAt: number = now,
  offsetMs: number | null = null
): InviteView {
  if (!row || row.status !== "invited") return { state: "none" };
  const deadline = inviteDeadline(row.inviteExpiresAt, firstSeenAt, { offsetMs, createdAt: row.createdAt });
  if (deadline === null) {
    if (now >= firstSeenAt + INVITE_TTL_MS) return { state: "expired", requestId: row.id };
    return { state: "open", requestId: row.id, secondsLeft: null };
  }
  const left = Math.ceil((deadline - now) / 1000);
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

/** The invitee's countdown, saying what it counts: a bare `0:42` could be a slot's length. */
export function inviteCountdownLabel(seconds: number): string {
  return `Answer in ${formatCountdown(seconds)}`;
}

/** The host's Invited row: the time before the invitation ends. */
export function invitedCountdownLabel(seconds: number): string {
  return `ends in ${formatCountdown(seconds)}`;
}

/**
 * While an answer is on the wire: the tapped button's label, and one status
 * line for a screen reader. Without them a slow connection only dimmed both
 * buttons, and the answer looked broken.
 */
export function answerBusyCopy(action: "accept" | "reject"): { label: string; status: string } {
  return action === "accept"
    ? { label: "Joining…", status: "Joining the stage…" }
    : { label: "Declining…", status: "Sending your answer…" };
}

/**
 * Said once to a screen reader when an invitation arrives. It gives the time
 * limit sighted readers see ticking (WCAG 2.2.1) and names the region the two
 * answers are in, and promises nothing about a seat or a mic.
 *
 * It names the REGION, not a place: with a sheet open the banner is drawn
 * inside that sheet's dialog (components/ui/modal-layer.tsx), and "at the top
 * of the page" sent a reader to the sheet's Close button.
 */
export function inviteAnnouncement(hostName: string | null | undefined, secondsLeft: number | null): string {
  const who = hostName?.trim() || "The host";
  const where = "Join as speaker, or Not now, in the Invitation to speak region.";
  if (secondsLeft === null) return `${who} invited you to speak. ${where}`;
  const whole = Math.max(1, Math.ceil(secondsLeft));
  const within = whole >= 60 && whole % 60 === 0 ? `${whole / 60} minute${whole === 60 ? "" : "s"}` : `${whole} seconds`;
  return `${who} invited you to speak. Answer within ${within}: ${where}`;
}

/**
 * When the one warning before an invitation runs out is said: 20 seconds
 * ahead, the least WCAG 2.2.1 asks, so a reader who has to find the banner
 * past an open sheet still has time to answer. The 60 seconds cannot be
 * extended yet: that needs a longer TTL or an extend route from the service.
 */
export const INVITE_WARNING_SECONDS = 20;

export interface InviteAnnouncerState {
  /** The invitation already announced, or null. */
  requestId: string | null;
  warned: boolean;
  answered: boolean;
}

export const INITIAL_INVITE_ANNOUNCER: InviteAnnouncerState = { requestId: null, warned: false, answered: false };

/**
 * What the screen reader is told about the reader's invitation, one reading
 * at a time: the invitation once, one warning near the end, and a closing line
 * when it ends unanswered. ONE announcer for the whole session — the room page
 * and the mini-player each announcing on mount repeated it every time the
 * reader moved between them.
 */
export function stepInviteAnnouncer(
  state: InviteAnnouncerState,
  input: { requestId: string | null; hostName: string | null | undefined; secondsLeft: number | null; answered: boolean }
): { state: InviteAnnouncerState; say: string | null } {
  if (input.requestId && input.requestId !== state.requestId) {
    return {
      state: {
        requestId: input.requestId,
        warned: input.secondsLeft !== null && input.secondsLeft <= INVITE_WARNING_SECONDS,
        answered: input.answered,
      },
      say: inviteAnnouncement(input.hostName, input.secondsLeft),
    };
  }
  if (input.requestId) {
    const answered = state.answered || input.answered;
    if (!answered && !state.warned && input.secondsLeft !== null && input.secondsLeft <= INVITE_WARNING_SECONDS) {
      return {
        state: { ...state, warned: true },
        say: `${INVITE_WARNING_SECONDS} seconds left to answer the invitation to speak.`,
      };
    }
    return { state: { ...state, answered }, say: null };
  }
  if (state.requestId) {
    const answered = state.answered || input.answered;
    return { state: INITIAL_INVITE_ANNOUNCER, say: answered ? null : "The invitation to speak has ended." };
  }
  return { state, say: null };
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

/** The reader's own row, as far as releasing it goes. */
export interface ReleasableRow {
  id: string;
  status: string;
}

/** An answer to an invitation that has been sent and has not come back yet. */
export interface InflightAnswer {
  requestId: string;
  action: "accept" | "reject";
  /** The row the service answered with, or null when the answer failed. Never rejects. */
  settled: Promise<ReleasableRow | null>;
}

/**
 * LEAVING WHILE "JOIN AS SPEAKER" IS STILL ON THE WIRE.
 *
 * The cached row still says `invited` until the accept comes back, so the
 * plain rule answered `reject` — and if the accept landed first the reject
 * was refused (the invitation was no longer open) and the service kept a
 * SEAT for somebody who had gone. So:
 *
 *  - an accept in flight for this row: wait for it to settle, then release
 *    what the row IS — `leave` once it is `approved`, `reject` if the accept
 *    failed and the invitation is still open, nothing if it ended;
 *  - a reject in flight: that is already the answer, send nothing more;
 *  - otherwise the row's own status decides (`releaseActionFor`).
 *
 * `latest` reads the newest cached row (a successful answer writes it there
 * before `settled` resolves). `send` must be bound to the room being LEFT:
 * by the time an accept settles the session has moved on.
 */
export async function releaseOnLeave(input: {
  row: ReleasableRow | null | undefined;
  inflight: InflightAnswer | null;
  latest: () => ReleasableRow | null | undefined;
  send: (requestId: string, action: "leave" | "reject") => unknown;
}): Promise<void> {
  const { row, inflight, latest, send } = input;
  const pending = inflight && (!row || row.id === inflight.requestId) ? inflight : null;
  if (pending?.action === "reject") return;
  if (pending?.action === "accept") {
    const settled = await pending.settled;
    const cached = latest();
    const after = settled?.id === pending.requestId ? settled : cached?.id === pending.requestId ? cached : null;
    const action = releaseActionFor(after?.status);
    if (after && action) await send(after.id, action);
    return;
  }
  const action = releaseActionFor(row?.status);
  if (row && action) await send(row.id, action);
}

/**
 * Keeps the answer that is on the wire, so a leave can wait for it. The
 * returned entry's `settled` never rejects; the slot clears itself when the
 * answer settles, unless a newer answer has taken it.
 */
export function createInflightAnswers() {
  let current: InflightAnswer | null = null;
  return {
    current: () => current,
    track(requestId: string, action: "accept" | "reject", answer: Promise<ReleasableRow>): InflightAnswer {
      const settled = answer.then(
        (row) => row,
        () => null
      );
      const entry: InflightAnswer = { requestId, action, settled };
      current = entry;
      void settled.then(() => {
        if (current === entry) current = null;
      });
      return entry;
    },
  };
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
  /** Still in the room. Absent means not known, which is read as present. */
  present?: boolean;
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
  /** The host banned this person from the room (SPEAKER_BANNED). */
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
  // Hidden, not disabled, on the host's own ban. A BLOCKED refusal never sets
  // this (inviteErrorOutcome): the block may be the target's, and a control
  // that changes after one tap would tell the host so.
  if (input.refused) return { kind: "hidden" };
  if (target.openInviteId) return { kind: "invited", requestId: target.openInviteId };
  if (target.present === false) return { kind: "invite", disabled: true, reason: "They've left the room." };
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
  return who ? `${who} isn't available to speak right now.` : "They aren't available to speak right now.";
}

/** What the host is told when the invite went through: an invitation, or a raised hand seated. */
export function inviteSentMessage(status: string, name: string): string {
  return status === "approved" ? `${name} already asked, so they're joining the stage.` : `Invited ${name} to speak.`;
}

export interface TrackedInvite {
  id: string;
  userId: string;
  name: string;
  /** Local epoch ms the invitation is held open until (`inviteDeadline`, or first seen + 60s). */
  deadline: number;
  /** The deadline came from the server's expiry, so a countdown may be drawn. */
  timed: boolean;
  /** The last reading that looked at it. */
  checkedAt: number;
  /** When the readings last started again after a gap (the host away from the room). */
  resumedAt: number;
}

/**
 * The service's pause before the same person can be invited again, started on
 * every refusal and every lapse (wsws-monorepo stream-service
 * `inviteCooldownActive`).
 */
export const INVITE_COOLDOWN_MS = 180_000;

/**
 * Until when the host's control stays disabled after an invitation ended
 * without a seat.
 *
 * Counted from the invitation's DEADLINE for both endings: the host is told
 * the two the same way, and a cooldown that ran out sooner after a refusal
 * would tell them which it was. It can only run long, never offer a tap the
 * service refuses. A longer "not yet" the service already named is kept.
 */
export function endedInviteCooldownUntil(invite: Pick<TrackedInvite, "deadline">, current: number | null | undefined): number {
  return Math.max(current ?? 0, invite.deadline + INVITE_COOLDOWN_MS);
}

/**
 * How long past an invitation's end the host waits before being told. The
 * invited list, the approved list and the LiveKit grant all arrive
 * separately; an accept seen in one before the other must not read as a
 * refusal.
 */
export const OUTCOME_GRACE_MS = 6_000;

/** The part of a row the host's tracking reads. */
export interface OpenInvite {
  id: string;
  userId: string;
  name: string;
  inviteExpiresAt: string | null;
  createdAt?: string | null;
}

function startTracking(item: OpenInvite, now: number, clock: { offsetMs?: number | null; ttlMs?: number }): TrackedInvite {
  const ttl = clock.ttlMs ?? INVITE_TTL_MS;
  const deadline = inviteDeadline(item.inviteExpiresAt, now, { offsetMs: clock.offsetMs, createdAt: item.createdAt, ttlMs: ttl });
  return {
    id: item.id,
    userId: item.userId,
    name: item.name,
    deadline: deadline ?? now + ttl,
    timed: deadline !== null,
    checkedAt: now,
    resumedAt: now,
  };
}

/**
 * Start following an invitation from the invite's own answer, before any list
 * read has listed it. Without this an invitation answered before the host's
 * first read (the host minimised the room at once, or the invitee answered
 * off the push) was never tracked: a decline got no Invited row and no line,
 * where a lapse got both — which told the host which one it was.
 * The same array back when it is already tracked.
 */
export function trackInvite(
  tracked: readonly TrackedInvite[],
  item: OpenInvite,
  now: number,
  clock: { offsetMs?: number | null; ttlMs?: number } = {}
): readonly TrackedInvite[] {
  if (tracked.some((invite) => invite.id === item.id)) return tracked;
  return [...tracked, startTracking(item, now, clock)];
}

/**
 * Follow the host's invitations from one read to the next.
 *
 * Settled by what happened to the PERSON, never by a row's status: seated says
 * nothing, taken back by the host says nothing. Anything else is "isn't
 * available", told at ONE moment for every ending: the invitation's own
 * deadline plus the grace, whether or not the invited list still carries it.
 * A refusal leaves the list at once and a lapse only at the first poll after
 * the server's expiry, so a line timed from when the row left the list landed
 * a poll's jitter later for a lapse, and "exactly six seconds after the row
 * went" meant declined — which the product never tells the host.
 *
 * The one exception is a host coming back to the room after the deadline:
 * the lists they are about to read may be stale, so the line waits the grace
 * from their return (`resumedAt`). That tells them nothing, since they were
 * not watching when it ended.
 *
 * `endedIds` are invitations already told; a late read still listing one does
 * not start it again. The tracked list is plain data so it can outlive the
 * room page.
 */
export function settleInvites(
  tracked: readonly TrackedInvite[],
  input: {
    open: readonly OpenInvite[];
    seatedUserIds: ReadonlySet<string>;
    cancelledIds: ReadonlySet<string>;
    endedIds?: ReadonlySet<string>;
    /** The server's clock offset (lib/server-clock.ts), when one has been read. */
    offsetMs?: number | null;
    now: number;
    graceMs?: number;
    ttlMs?: number;
  }
): { tracked: TrackedInvite[]; unavailable: TrackedInvite[] } {
  const grace = input.graceMs ?? OUTCOME_GRACE_MS;
  const ended = input.endedIds ?? new Set<string>();
  const openIds = new Map(input.open.map((item) => [item.id, item]));
  const next: TrackedInvite[] = [];
  const unavailable: TrackedInvite[] = [];
  const seen = new Set<string>();
  for (const invite of tracked) {
    seen.add(invite.id);
    if (input.cancelledIds.has(invite.id) || ended.has(invite.id)) continue;
    if (input.seatedUserIds.has(invite.userId)) continue;
    const resumedAt = input.now - invite.checkedAt > grace ? input.now : invite.resumedAt;
    const still = openIds.get(invite.id);
    const current = { ...invite, name: still?.name || invite.name, checkedAt: input.now, resumedAt };
    if (input.now >= Math.max(invite.deadline, resumedAt) + grace) unavailable.push(current);
    else next.push(current);
  }
  for (const item of input.open) {
    if (seen.has(item.id) || input.cancelledIds.has(item.id) || ended.has(item.id)) continue;
    next.push(startTracking(item, input.now, { offsetMs: input.offsetMs, ttlMs: input.ttlMs }));
  }
  return { tracked: next, unavailable };
}

/** The invitations the host still sees as open (the Invited rows, the card badge, Cancel). */
export function visibleInvites(tracked: readonly TrackedInvite[], now: number): TrackedInvite[] {
  return tracked.filter((invite) => now < invite.deadline);
}

/**
 * The reader's invitation, only off a row the session is still reading.
 *
 * The query keeps its last data when it is switched off, so a room that ended
 * or a reconnect that gave up (a private room's 403) left a cached `invited`
 * row drawing a Join banner for a room the reader was no longer in.
 */
export function liveInviteRow<T extends { status: string }>(
  row: T | null | undefined,
  input: { polling: boolean; isHost: boolean }
): T | null {
  if (!input.polling || input.isHost || !row || row.status !== "invited") return null;
  return row;
}

/* ------------------------------------------------------------------ *
 * Error answers
 * ------------------------------------------------------------------ */

export interface ApiErrorLike {
  code?: string | null;
  status?: number;
  message?: string | null;
  details?: unknown;
}

/**
 * The router's own "no such route", as opposed to "no such thing".
 *
 * Every Market Square service ends its Express app with
 * `fail('NOT_FOUND', 'Route not found')`; an entity that is missing is a
 * `NotFoundError` with its own sentence ("Profile not found", "Stream not
 * found") and — on this service — no `details` at all. A proxy with no
 * envelope answers Express's default page ("Cannot POST /…"). Only those two
 * shapes say the route is absent.
 */
const ROUTE_MISS = [/^\s*route not found\.?\s*$/i, /\bCannot (GET|POST|PUT|PATCH|DELETE) \//];

/**
 * Did this call reach a route that is not deployed?
 *
 * NOT every 404: a write aimed at a PERSON answers 404 when that person has
 * gone (a deleted profile, a private room they can't see, a speaker who just
 * left). Reading that as "not deployed" switched the whole feature off for the
 * tab — every Invite, the Invited list and its Cancel buttons — on one invite
 * to one missing person. So a 404 is "not deployed" only in the router's own
 * words, and never when the service named the missing resource. Before invite
 * ships, the existing action route and the list's `status` filter refuse the
 * new values with a VALIDATION_ERROR naming `action` or `status`; that is the
 * same answer in a different shape.
 */
export function routeMissing(error: ApiErrorLike | null | undefined): boolean {
  if (!error) return false;
  const details = error.details as { resource?: unknown } | unknown[] | null | undefined;
  if (error.code === "NOT_FOUND") {
    if (details && !Array.isArray(details) && typeof details === "object" && "resource" in details) return false;
    const message = error.message ?? "";
    return ROUTE_MISS.some((pattern) => pattern.test(message));
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
  /** Not deployed: hide the control, and say so once — the host's tap must not vanish unanswered. */
  | { kind: "unavailable"; message: string }
  /** Banned from this room by the host: hide the control for this person. */
  | { kind: "refused"; message: string }
  /** Try again later: disable with a countdown. */
  | { kind: "cooldown"; message: string; retryAfterSeconds: number }
  | { kind: "message"; message: string };

function retryAfter(details: unknown): number | null {
  const value = (details as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

const GENERIC_INVITE_FAILURE = "Couldn't send the invitation.";

/** What the host is told when the invite route is not deployed yet. */
export const INVITE_UNAVAILABLE = "Invite to speak isn't available yet.";

/** What the host is told when an invitation could not be sent. */
export function inviteErrorOutcome(error: ApiErrorLike | null | undefined, name?: string | null): InviteErrorOutcome {
  if (routeMissing(error)) return { kind: "unavailable", message: INVITE_UNAVAILABLE };
  const who = name?.trim() || "They";
  switch (error?.code) {
    case "STREAM_NOT_LIVE":
      return { kind: "message", message: "The gist room isn't live." };
    case "CANNOT_INVITE_SELF":
      return { kind: "message", message: "You're already on the stage." };
    case "NOT_FOUND":
      return { kind: "message", message: `${who} can't be invited to this room.` };
    // The host's own ban: nothing here they don't already know.
    case "SPEAKER_BANNED":
      return { kind: "refused", message: `${who} can't be invited to speak.` };
    // BLOCKED is either direction, and a block by the TARGET is theirs to keep
    // quiet: the same line as any failure, and the control stays as it was.
    case "BLOCKED":
      return { kind: "message", message: GENERIC_INVITE_FAILURE };
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
    // The service's code is TOO_MANY_REQUESTS; a bodyless 429 arrives as RATE_LIMITED.
    case "TOO_MANY_REQUESTS":
    case "RATE_LIMITED": {
      const seconds = retryAfter(error.details);
      return {
        kind: "message",
        message: seconds ? `Too many invitations. Try again in ${formatCountdown(seconds)}.` : "Too many invitations. Try again in a moment.",
      };
    }
    default:
      return { kind: "message", message: GENERIC_INVITE_FAILURE };
  }
}

/**
 * What the invitee is told when answering could not go through, or null for
 * nothing. A Not now on an invitation that already ended is the answer they
 * gave coming true, not an error (`quietResolveError`); a Join still says so.
 */
export function answerErrorMessage(error: ApiErrorLike | null | undefined, action: "accept" | "reject" = "accept"): string | null {
  if (action === "reject" && quietResolveError(error, "reject")) return null;
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

/**
 * A Cancel that really did not go through, so the invitation is still open
 * and must come back on the host's screen. One that failed only because the
 * invitation had already ended is the Cancel's own outcome.
 */
export function cancelFailedForReal(error: ApiErrorLike | null | undefined): boolean {
  return !quietResolveError(error, "cancel");
}

/**
 * A resolve that failed only because the invitation had already ended.
 *
 * The host's Cancel racing the invitee's Join, and a Not now sent on the way
 * out of the room seconds after the server lapsed the invitation, both answer
 * INVITE_NOT_OPEN. A `leave` or `reject` on a row that is still an open
 * invitation answers AWAITING_INVITEE. Either way the thing the person asked
 * for (the invitation is not open) is already true, so it is not an error
 * toast, least of all to somebody who has just left the room. The lists are
 * read again all the same.
 */
export function quietResolveError(error: ApiErrorLike | null | undefined, action: string): boolean {
  const code = error?.code;
  if (action === "cancel" || action === "reject") return code === "INVITE_NOT_OPEN" || code === "AWAITING_INVITEE";
  if (action === "leave") return code === "AWAITING_INVITEE";
  return false;
}

/**
 * ONE ANSWER PER INVITATION, however fast the taps.
 *
 * The banner's `busy` is the mutation's pending flag, which only reaches the
 * buttons on the next render — so two taps in one frame (a double tap, a
 * bouncing switch, Enter held down) both got through, sending the answer and
 * the "Tap the mic when you're ready" hint twice. The latch is synchronous:
 * the first claim on an invitation wins and every later one is refused until
 * the answer FAILS and is released, so a network error can still be retried.
 * A new invitation is a new id and claims afresh.
 *
 * An answer that went through is let go once the invitation is no longer the
 * one on screen (`follow`). Held for good, a later invitation the service
 * opened on the SAME row id drew a banner whose buttons did nothing, and the
 * host was told "isn't available" about someone who tried to accept.
 */
export interface AnswerLatch {
  /** True for the first claim on this invitation; false while one is held. */
  claim(requestId: string): boolean;
  /** The answer failed: the reader may answer again. */
  release(requestId: string): void;
  /** The invitation on screen now, or null: a hold on any other is let go. */
  follow(currentId: string | null): void;
}

export function createAnswerLatch(): AnswerLatch {
  let held: string | null = null;
  return {
    claim(requestId) {
      if (held === requestId) return false;
      held = requestId;
      return true;
    },
    release(requestId) {
      if (held === requestId) held = null;
    },
    follow(currentId) {
      if (held !== currentId) held = null;
    },
  };
}

/**
 * Where an answer to an invitation lands once it comes back.
 *
 * The answer is pinned to the room it was sent from (`room`). The session can
 * move on while it is out ("Leave and join" another room): the hook's own id
 * is then the NEXT room's, and writing the answered row under it made the
 * reader a seated speaker there. The seated hint is said only while the
 * reader is still in that room.
 */
export function answerLanding(input: {
  room: string;
  currentRoom: string | null | undefined;
  action: "accept" | "reject";
  status: string;
}): { room: string; hint: boolean } {
  return {
    room: input.room,
    hint: input.action === "accept" && input.status === "approved" && input.room === input.currentRoom,
  };
}
