import test from "node:test";
import assert from "node:assert/strict";
import { liveRoomFaces, ROOM_FACE_LIMIT } from "../features/streams/lib/room-faces.ts";

const ada = { id: "ada", username: "ada" };
const grace = { id: "grace", username: "grace" };
const alan = { id: "alan", username: "alan" };
const edsger = { id: "edsger", username: "edsger" };

/*
  THE BUG THIS FILE EXISTS FOR.

  The live card read `stream.attendees` and drew an empty stack on a room that
  had somebody in it. Nothing failed: `attendees` is `.optional().default([])`,
  so an absent field parses to `[]`, and `[].map(...)` renders nothing at all.
  Typecheck, lint, 2292 tests and the build were all happy with a card that had
  no faces on it.

  `attendees` is the ENDED-room field — its own schema note says "Absent while a
  room is LIVE". Measured against this stack on 2026-09-23:
  `GET /streams?status=live&kind=room` returns `owner` hydrated,
  `participants: []`, and no `attendees` key at all.

  So the rule is pinned here, by behaviour rather than by reading the JSX.
*/

test("the host alone is a face — a live room never looks abandoned", () => {
  // Today's real payload: participants empty, owner hydrated.
  assert.deepEqual(liveRoomFaces({ participants: [], owner: ada }), [ada]);
});

test("who is actually connected comes first, then the host", () => {
  assert.deepEqual(liveRoomFaces({ participants: [grace, alan], owner: ada }), [grace, alan, ada]);
});

test("a host inside their own sample is not drawn twice", () => {
  // The sample is documented as host-first, so this is the ORDINARY case, not
  // an edge one. A face drawn twice reads as a bug.
  assert.deepEqual(liveRoomFaces({ participants: [ada, grace], owner: ada }), [ada, grace]);
});

test("three plates at most, because the card draws three", () => {
  assert.equal(ROOM_FACE_LIMIT, 3);
  assert.deepEqual(liveRoomFaces({ participants: [grace, alan, edsger], owner: ada }), [
    grace,
    alan,
    edsger,
  ]);
});

test("the house roster fills only the places presence and the host left empty", () => {
  // Last tier, and it is the order production has shipped for months: the
  // people the invite is addressed to, when nobody connected is resolvable.
  assert.deepEqual(liveRoomFaces({ participants: [], owner: ada, roster: [grace, alan, edsger] }), [
    ada,
    grace,
    alan,
  ]);
  // Presence still outranks it: a connected stranger beats a house member.
  assert.deepEqual(liveRoomFaces({ participants: [grace], owner: ada, roster: [edsger] }), [
    grace,
    ada,
    edsger,
  ]);
});

test("a host who is also in their own house is not drawn twice", () => {
  assert.deepEqual(liveRoomFaces({ participants: [], owner: ada, roster: [ada, grace] }), [
    ada,
    grace,
  ]);
});

test("a room with nobody resolvable draws nothing rather than a placeholder", () => {
  // An empty stack is honest when there is genuinely no one to name — it is
  // only a bug when somebody IS there, which is what the first test pins.
  assert.deepEqual(liveRoomFaces({ participants: [], owner: null, roster: [] }), []);
  assert.deepEqual(liveRoomFaces({}), []);
});

test("attendees is NEVER a source — it is the ended-room field", () => {
  /*
    The regression, stated as an assertion. If someone re-adds `attendees` to
    the sources, this fails: a room that is live and has an owner would start
    drawing whoever the replay field happens to carry, and — much worse — a
    payload with ONLY attendees would look like it worked.
  */
  const faces = liveRoomFaces({
    participants: [],
    owner: null,
    roster: [],
    // @ts-expect-error — not part of the input type; passed to prove it is ignored.
    attendees: [grace, alan],
  });
  assert.deepEqual(faces, [], "the live card is reading the ended-room field again");
});

/*
  ─── THE GIFT RECIPIENT CONTRACT, PINNED BEFORE IT IS LIVE ───────────────────

  `toProfileId` is built (service PR #308) but NOT merged and NOT deployed, so
  the money leg stays off. What is pinned here is the CLIENT's half of the
  agreement, because the parts that are easy to get wrong are the parts nobody
  looks at again once it ships.
*/
import { recipientLeftTheRoom, RECIPIENT_GONE } from "../features/tips/lib/availability.ts";
import { readFileSync } from "node:fs";

test("'they just left' is told apart from 'you may not do this'", () => {
  // A 409 RECIPIENT_NOT_IN_ROOM is not a refusal of the act — the sender did
  // nothing wrong and the room simply moved. Collapsing it into a generic
  // failure makes somebody feel at fault for another person walking out.
  assert.equal(RECIPIENT_GONE, "RECIPIENT_NOT_IN_ROOM");
  assert.equal(recipientLeftTheRoom({ code: "RECIPIENT_NOT_IN_ROOM" }), true);
  assert.equal(recipientLeftTheRoom({ code: "FORBIDDEN" }), false);
  assert.equal(recipientLeftTheRoom({ code: "RATE_LIMITED" }), false);
  assert.equal(recipientLeftTheRoom(null), false);
  assert.equal(recipientLeftTheRoom(new Error("network")), false);
});

test("toUserId carries NO default, so silence is not mistaken for 'nobody'", () => {
  /*
    Pinned by reading the schema rather than by parsing, because
    `features/tips/lib/types.ts` imports through the `@/` alias, which the node
    test runner does not resolve.

    NO DEFAULT is the feature switch. A deployment predating the recipient
    field answers without it, and that is a different sentence from "it carries
    one and the answer is null". A default would merge the two and let a
    receipt claim the service confirmed a recipient it never mentioned — which
    defeats the entire reason the field is read back rather than assumed from
    what the client sent.
  */
  const types = readFileSync("features/tips/lib/types.ts", "utf8");
  assert.match(types, /toUserId: z\.string\(\)\.nullable\(\)\.optional\(\),/);
  assert.doesNotMatch(
    types,
    /toUserId: z\.string\(\)\.nullable\(\)\.optional\(\)\.default\(/,
    "an older service's silence now reads as a confirmed recipient"
  );
});

// The client sends the recipient for EVERY row including the host: the service
// exempts the host from its presence check, so naming them explicitly behaves
// identically to omitting the field, and a picker that special-cased its first
// row would carry a second code path for no gain.
test("the stream route is the only one given a recipient", () => {
  const api = readFileSync("features/tips/lib/api.ts", "utf8");
  assert.match(api, /const giftBody = toProfileId \? \{ \.\.\.body, toProfileId \} : body;/);
  assert.match(api, /\/streams\/\$\{target\.id\}\/gifts`, giftBody\)/);
  // A post's author and a profile itself ARE the recipient by construction —
  // passing one there would invent a parameter the service does not read.
  assert.match(api, /\/posts\/\$\{target\.id\}\/tips`, body\)/);
  assert.match(api, /\/profiles\/\$\{target\.id\}\/tips`, body\)/);
});

test("the payment hold key distinguishes WHO is being paid", () => {
  /*
    A hold remembers a payment this device SIGNED but failed to report, so a
    retry reports it instead of charging twice. Its key was
    `tip:<kind>:<id>` plus the amount — which did not name the recipient,
    because until `toProfileId` a stream gift had exactly one possible one.

    It does not any more. Two gifts of the SAME amount, in the SAME room, to
    DIFFERENT people would have collided on one key, and the recovery path
    would have reported a transfer signed for one person against a tip created
    for another — money credited to the wrong person BY THE MECHANISM BUILT TO
    STOP MONEY BEING TAKEN TWICE.

    Pinned by reading the source: the hook imports through the `@/` alias,
    which the node runner does not resolve.
  */
  const hooks = readFileSync("features/tips/hooks/use-tips.ts", "utf8");
  assert.match(
    hooks,
    /holdKey\(`tip:\$\{target\.kind\}:\$\{target\.id\}:\$\{toProfileId \?\? ""\}`, amountKash\)/,
    "the hold key no longer distinguishes recipients"
  );
  // Empty string for "the host", so holds written before the field existed
  // keep their key and stay recoverable.
  assert.ok(hooks.includes('toProfileId ?? ""'), "an older hold's key changed and became unrecoverable");
});

/*
  ─── THE GIFT ECONOMY: BUY, HOLD, SPEND ─────────────────────────────────────

  ogazboiz, 2026-09-24: "just like tiktok gift system — they can buy and hold
  them and when they are in the gist room they can send it to someone, and
  again and buy kash". So a gift is an OBJECT you own, and the client is built
  for that now; the service's three routes do not exist yet, and every caller
  treats their absence as a feature switch rather than an error.
*/
test("the gift economy is THREE states, not two", () => {
  /*
    `undefined` while the lookup is in flight, `false` once a 404 has been
    seen, `true` once the route answers. A control that hid itself while the
    read was still in the air would flicker on every load, and one that hid on
    a network blip would remove a feature over a dropped packet — so only a
    NOT_FOUND is allowed to turn it off.
  */
  const hooks = readFileSync("features/gifts/hooks/use-gifts.ts", "utf8");
  assert.match(hooks, /if \(query\.isSuccess\) return true;/);
  assert.match(hooks, /errorCode\(query\.error\) === "NOT_FOUND" \? false : undefined/);
  assert.match(hooks, /return undefined;/);
});

test("a purchase never counts up optimistically", () => {
  /*
    Every other mutation in this app flips something the reader can see and
    rolls it back on failure. This one MOVES MONEY, and a count that rose
    before the charge landed is a claim that a purchase happened. The new
    quantity comes from the service's own answer.
  */
  const hooks = readFileSync("features/gifts/hooks/use-gifts.ts", "utf8");
  assert.doesNotMatch(hooks, /onMutate/, "the gift count is optimistic — it must not be");
  assert.match(hooks, /invalidateQueries\(\{ queryKey: INVENTORY_KEY \}\)/);
  // Buying spends COINS, so any surface showing that balance is stale too.
  assert.match(hooks, /invalidateQueries\(\{ queryKey: COINS_KEY \}\)/);
});

test("the client never names a gift's price", () => {
  /*
    `LIVE_GIFTS` is ours and stays ours for ARTWORK — artwork must never come
    off the wire, because the sender is another browser whose build may be
    ahead of this one. The PRICE is the service's: the moment a gift id
    selects a price, a client naming both could post `bank` for a penny and
    show the room the most expensive animation in the tray.
  */
  const api = readFileSync("features/gifts/lib/api.ts", "utf8");
  // The REQUEST BODY, not the file: the note above `buyGift` names `priceKash`
  // precisely to say it is the service's, so a blanket search matches the
  // explanation rather than the defect.
  const body = api.slice(api.indexOf("export async function buyGift"));
  const posted = body.slice(body.indexOf('"/me/gifts"'), body.indexOf("Idempotency-Key"));
  assert.doesNotMatch(posted, /price/i, "the client is sending a price it must not choose");
  assert.match(posted, /\{ giftId: input\.giftId, quantity: input\.quantity \}/);
});

test("an idempotency key is one per INTENT, not one per attempt", () => {
  // A key minted per render or per retry is a new key each time and protects
  // nothing. Keyed on the gift and the quantity, so three Roses then three
  // more is two intents while retrying the first is one.
  const gallery = readFileSync("components/layout/profile-gift-gallery.tsx", "utf8");
  assert.match(gallery, /function buyKey\(giftId: string, quantity: number\): string \{/);
  assert.match(gallery, /return `gift:\$\{giftId\}:\$\{quantity\}`;/);
});

test("every coin price is exactly its KASH price times the rate", () => {
  /*
    THE COIN LADDER WAS DERIVED FROM THE KASH ONE, on purpose: switching the
    displayed unit changes what a reader SEES and nothing about what anything
    COSTS. A rose is 10 coins because it is 0.01 KASH, not because somebody
    picked 10.

    So if these two ever disagree, the tile is lying about one of them — and
    the one it is lying about is whichever the service does not hold. Pinned
    across all fourteen rungs rather than spot-checked, because the ones that
    would drift are the sub-unit ones nobody reads twice.
  */
  const gifts = readFileSync("lib/gifts.ts", "utf8");
  const rate = Number(/COINS_PER_KASH = (\d+)/.exec(gifts)?.[1]);
  assert.equal(rate, 1000);

  const rows = [...gifts.matchAll(/priceCoins: (\d+), priceKash: "([\d.]+)"/g)];
  assert.equal(rows.length, 14, "the ladder changed length — re-check both units");
  for (const [, coins, kash] of rows) {
    // Compared in integer coins, never in floats: 0.1 * 1000 is 100.00000000000001.
    const fromKash = Math.round(Number(kash) * rate);
    assert.equal(
      Number(coins),
      fromKash,
      `a rung disagrees: ${coins} coins vs ${kash} KASH x ${rate} = ${fromKash}`
    );
  }
});
