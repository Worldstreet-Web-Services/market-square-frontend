import assert from "node:assert/strict";
import { test } from "node:test";
import { exceedsBalance, multiplyKash } from "./kash-amount.ts";
import { readFileSync } from "node:fs";
import {
  canSendTip,
  tipAmountOutOfBounds,
  tipBlockedBecause,
  tipBoundsMessage,
  tipSurfaceOf,
} from "./tip-capability.ts";

/** What production actually publishes today. */
const LIVE = {
  enabled: true,
  settlement: "client-signed" as const,
  minKash: "1",
  maxKash: "10000",
  verifiedAuthorsOnly: true,
};
const verified = { verification: "verified" };

test("the amounts the sheet shipped with are BELOW the server's minimum", () => {
  // The bug: the sheet defaulted to 0.05 KASH and the gift tray's eight
  // cheapest tiles all sit under a whole KASH, while the service refuses
  // anything under 1. Tapping the rose and sending was rejected every time.
  for (const amount of ["0.01", "0.02", "0.05", "0.1", "0.15", "0.2", "0.25", "0.5"]) {
    assert.equal(tipAmountOutOfBounds(amount, LIVE), "below-min", amount);
    assert.equal(canSendTip(amount, LIVE, verified), false, amount);
  }
});

test("the amounts at or above the minimum are accepted", () => {
  for (const amount of ["1", "1.00", "2", "5", "10", "10000"]) {
    assert.equal(tipAmountOutOfBounds(amount, LIVE), null, amount);
    assert.equal(canSendTip(amount, LIVE, verified), true, amount);
  }
});

test("the ceiling is enforced too, and named", () => {
  assert.equal(tipAmountOutOfBounds("10001", LIVE), "above-max");
  assert.equal(tipBoundsMessage("above-max", LIVE), "The largest tip is 10000 KASH.");
  assert.equal(tipBoundsMessage("below-min", LIVE), "The smallest tip is 1 KASH.");
});

test("bounds are compared as decimals, never as floats or text", () => {
  // "0.9" > "1" lexicographically, and 0.1+0.2 is not 0.3 as a float.
  assert.equal(tipAmountOutOfBounds("0.9", LIVE), "below-min");
  assert.equal(tipAmountOutOfBounds("9", { ...LIVE, maxKash: "10" }), null);
  assert.equal(tipAmountOutOfBounds("2", { ...LIVE, minKash: "10" }), "below-min");
});

test("only a VERIFIED recipient may be tipped while the server says so", () => {
  assert.equal(tipBlockedBecause(LIVE, verified), null);
  // `lapsed` is a verified account whose payment ran out. It must never be
  // treated as verified — least of all where money is about to move.
  for (const state of ["none", "pending", "lapsed", undefined, null]) {
    assert.equal(tipBlockedBecause(LIVE, { verification: state }), "unverified-recipient", String(state));
  }
  assert.equal(tipBlockedBecause(LIVE, null), "unverified-recipient");
});

test("with the rule off, anybody may be tipped", () => {
  const open = { ...LIVE, verifiedAuthorsOnly: false };
  assert.equal(tipBlockedBecause(open, { verification: "none" }), null);
  assert.equal(tipBlockedBecause(open, null), null);
});

test("tipping switched off blocks everyone, verified or not", () => {
  assert.equal(tipBlockedBecause({ ...LIVE, enabled: false }, verified), "disabled");
});

test("an ABSENT capability is permissive, so a slow lookup never breaks tipping", () => {
  // The read can fail or still be in flight. Hiding every tip control because
  // a lookup has not come back would break the feature to fix a message; the
  // service refuses what it must.
  assert.equal(tipBlockedBecause(null, null), null);
  assert.equal(tipBlockedBecause(undefined, { verification: "none" }), null);
  assert.equal(tipAmountOutOfBounds("0.01", null), null);
  assert.equal(canSendTip("0.01", null, null), true);
});

test("an unparseable bound is ignored rather than forbidding everything", () => {
  assert.equal(tipAmountOutOfBounds("5", { ...LIVE, minKash: "abc" }), null);
  assert.equal(tipAmountOutOfBounds("abc", LIVE), null);
});

/*
  ─── TWO BADGE RULES, ONE PER SURFACE ────────────────────────────────────────

  The service publishes `verifiedAuthorsOnly` for POST tips and
  `verifiedRoomRecipientsOnly` for GIST ROOM gifts, and they disagree on
  purpose. The badge stops an impersonation account collecting on a byline the
  sender has never met — a POST. In a room the sender picked a person off a
  live roster, in a room they are both in, that the host let them into, while
  that person is speaking; the attack barely exists and the rule's cost is that
  most of the room can receive nothing.

  Reading the wrong flag on the wrong surface is the failure this pins: it
  would grey out people the service will happily pay, and it would do it
  silently, because a hidden control raises no error.
*/
const ROOMS_OPEN = { ...LIVE, verifiedAuthorsOnly: true, verifiedRoomRecipientsOnly: false };
const UNVERIFIED = { verification: "none" };
const VERIFIED = { verification: "verified" };

test("opening ROOMS does not open POSTS", () => {
  // The service kept these as two switches precisely so one could move without
  // the other. If the client collapses them, that care is undone on the client
  // side and post tipping quietly opens to everybody.
  assert.equal(tipBlockedBecause(ROOMS_OPEN, UNVERIFIED, "room"), null);
  assert.equal(tipBlockedBecause(ROOMS_OPEN, UNVERIFIED, "post"), "unverified-recipient");
});

test("the surface defaults to POST, so callers that predate the flag are unchanged", () => {
  // A new parameter must not quietly change what the surfaces written before
  // it decide about money.
  assert.equal(tipBlockedBecause(ROOMS_OPEN, UNVERIFIED), "unverified-recipient");
  assert.equal(tipBlockedBecause(LIVE, UNVERIFIED), "unverified-recipient");
});

test("a service with ONE switch still applies it to rooms", () => {
  /*
    `undefined` means "this deployment has one switch", NOT "rooms are open".
    Production today publishes no room flag at all, so a room must go on
    obeying the author rule — anything else silently opens room gifting on
    every service that has never heard of the field.
  */
  // Stated as ABSENCE rather than by reading the property: `LIVE` is what
  // production publishes today and it does not carry the field at all, which
  // is the precise thing being pinned.
  assert.equal("verifiedRoomRecipientsOnly" in LIVE, false);
  assert.equal(tipBlockedBecause(LIVE, UNVERIFIED, "room"), "unverified-recipient");
  assert.equal(tipBlockedBecause(LIVE, VERIFIED, "room"), null);
});

test("`false` is a real answer and must not fall through to the author rule", () => {
  // The reason the fallback is `??` and not `||`: with `||`, a room flag of
  // `false` — the whole point of the change — would be treated as absent and
  // the author rule would apply, which is the exact bug this enables.
  assert.equal(tipBlockedBecause(ROOMS_OPEN, UNVERIFIED, "room"), null);
});

test("a room can still be closed on its own", () => {
  // The switch is a switch, not a one-way door: rooms closed while posts are
  // open has to work too, or the pair is not really independent.
  const roomsClosed = { ...LIVE, verifiedAuthorsOnly: false, verifiedRoomRecipientsOnly: true };
  assert.equal(tipBlockedBecause(roomsClosed, UNVERIFIED, "room"), "unverified-recipient");
  assert.equal(tipBlockedBecause(roomsClosed, UNVERIFIED, "post"), null);
});

test("tipping switched off beats both flags", () => {
  const off = { ...ROOMS_OPEN, enabled: false };
  assert.equal(tipBlockedBecause(off, VERIFIED, "room"), "disabled");
  assert.equal(tipBlockedBecause(off, VERIFIED, "post"), "disabled");
});

/*
  ─── AN HONEST TRAY: WHAT YOU CAN AFFORD, NOT JUST WHAT EXISTS ───────────────

  ogazboiz chose pay-at-send over buy-first inventory, so the fix for "it looks
  fake" is that every tile tells the truth — its real price, and whether this
  person can send it right now. A grid of fourteen objects, eight of which get
  refused at the last step, is the same complaint arriving from the other side.

  The comparison is decimal-string arithmetic, never floats: this is money, and
  `0.1 + 0.2` is the reason.
*/
test("a balance that is not known blocks nothing", () => {
  /*
    THE MOST IMPORTANT ONE. A balance still loading, or an account read that
    failed, must not grey out the tray — the interface would be inventing a
    shortfall it cannot see, and the service is the only thing that can
    actually refuse a spend. This is the same rule the balance chip and the
    earnings panel already follow for showing a number at all.
  */
  assert.equal(exceedsBalance("5", null), false);
  assert.equal(exceedsBalance("5", undefined), false);
  assert.equal(exceedsBalance(null, "1"), false);
});

test("a tile is blocked by its UNIT price, the button by the TOTAL", () => {
  /*
    Two different questions. A gift whose unit price is beyond the balance can
    never be sent at any quantity, so the tile is inert. A gift that is
    affordable once and not ten times is a QUANTITY problem — blocking the tile
    would tell the reader to pick a different gift when lowering the count is
    what fixes it.
  */
  const balance = "1.5";
  // Unit prices: a Rose at 0.01 is sendable, a Bank at 5 is not.
  assert.equal(exceedsBalance("0.01", balance), false);
  assert.equal(exceedsBalance("5", balance), true);
  // Totals: one Lion at 1 is fine, two are not — same tile, different answer.
  assert.equal(exceedsBalance(multiplyKash("1", 1) ?? "", balance), false);
  assert.equal(exceedsBalance(multiplyKash("1", 2) ?? "", balance), true);
});

test("exactly the balance is affordable", () => {
  // `> balance`, not `>=`. Spending everything you have is allowed; an
  // off-by-one here would refuse the one gift somebody saved up for.
  assert.equal(exceedsBalance("1.5", "1.5"), false);
  assert.equal(exceedsBalance("1.500001", "1.5"), true);
});

test("the total is multiplied exactly, so the tray blocks on the real figure", () => {
  // Three Roses is 0.03, not 0.030000000000000002 — and the second is both
  // the wrong number and one the engine rejects outright.
  assert.equal(multiplyKash("0.01", 3), "0.03");
  assert.equal(exceedsBalance(multiplyKash("0.01", 3) ?? "", "0.03"), false);
});

/**
 * PRODUCTION PUBLISHES TWO RULES AND THEY DISAGREE — deployed 2026-09-24:
 *
 *   verifiedAuthorsOnly         true   — a byline stays closed
 *   verifiedRoomRecipientsOnly  false  — a gist room is open to everyone
 *
 * They agreed until that deploy, which is why nothing noticed that the room's
 * own tip pill was asking the AUTHOR rule. The moment they diverged, the
 * control vanished for an unverified host the service would happily have paid:
 * no error, no refusal, just a button that was not there.
 */
const PROD = { ...LIVE, verifiedRoomRecipientsOnly: false };
const unverified = { verification: "unverified" };

test("a gist room is a room, and a byline is a byline", () => {
  // Derived from the target, never chosen by the caller — a `stream` IS the
  // gist room, since a room is a stream with category 'house'.
  assert.equal(tipSurfaceOf("stream"), "room");
  assert.equal(tipSurfaceOf("post"), "post");
  assert.equal(tipSurfaceOf("profile"), "post");
});

test("an unverified person in a room can be paid; the same person's byline cannot", () => {
  assert.equal(tipBlockedBecause(PROD, unverified, "room"), null);
  assert.equal(tipBlockedBecause(PROD, unverified, "post"), "unverified-recipient");
  // The whole point of the two flags: one answer must not stand in for the other.
  assert.notEqual(
    tipBlockedBecause(PROD, unverified, "room"),
    tipBlockedBecause(PROD, unverified, "post")
  );
});

test("the room's tip control asks the room rule, not the default", () => {
  /*
    The gate is in a component, so it is read as source. `tipBlockedBecause`
    defaults its surface to `post`, which is right for the callers that predate
    the room rule and wrong for this one — and a default is silent when it is
    wrong, which is exactly how this shipped.
  */
  const button = readFileSync(new URL("../features/tips/components/tip-button.tsx", import.meta.url), "utf8");
  assert.match(button, /tipBlockedBecause\(capability\.data, target\.recipient, tipSurfaceOf\(target\.kind\)\)/);
  assert.doesNotMatch(
    button,
    /tipBlockedBecause\(capability\.data, target\.recipient\)/,
    "the room's pill is back on the default surface"
  );
});

test("a deployment with ONE switch still applies it to rooms", () => {
  // `undefined` is not `false`: a service that has never heard of the room flag
  // means "there is one rule here", not "rooms are open". `??`, never `||`.
  assert.equal(tipBlockedBecause(LIVE, unverified, "room"), "unverified-recipient");
  assert.equal(tipBlockedBecause({ ...LIVE, verifiedRoomRecipientsOnly: false }, unverified, "room"), null);
});
