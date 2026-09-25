import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { tipAlreadyInFlight, recipientLeftTheRoom } from "../features/tips/lib/availability.ts";

/*
  A SEND THAT FAILED BEFORE BROADCASTING LEAVES A TIP THE SERVICE CALLS OPEN.

  One tip in flight per (target, sender, recipient) is the guard that stops a
  double-tap paying twice, and it is right. But nothing on the service ends
  that state except success — no TTL, no sweep, no cancel — so a send that
  fails before the transfer is broadcast leaves a pending row with no payment
  behind it, and every further attempt at that person is refused.

  ogazboiz hit it twice and was shown a raw `{"code":"CONFLICT"}` body.

  The client cannot finish that tip: the conflict carries `tipId` and nothing
  else — no `toWallet`, no `settlement.legs` — and no route reads a single tip.
  So the only honest thing left is to say so, and above all not to imply that
  paying again would help. It would not: it is refused before it reaches a
  wallet.
*/

test("the in-flight conflict is recognised, and told apart from its neighbours", () => {
  assert.equal(tipAlreadyInFlight({ code: "CONFLICT" }), true);

  // The other refusals on this path mean different things and must not be
  // swallowed by the same branch.
  assert.equal(tipAlreadyInFlight({ code: "RECIPIENT_NOT_IN_ROOM" }), false);
  assert.equal(tipAlreadyInFlight({ code: "INSUFFICIENT_COINS" }), false);
  assert.equal(recipientLeftTheRoom({ code: "CONFLICT" }), false);
});

test("anything that is not a coded error is not this", () => {
  for (const bad of [null, undefined, "CONFLICT", new Error("CONFLICT"), {}, { code: 409 }]) {
    assert.equal(tipAlreadyInFlight(bad), false, JSON.stringify(String(bad)));
  }
});

const root = new URL("..", import.meta.url).pathname;
const rooms = [
  "features/houses/components/house-room.tsx",
  "features/streams/components/stream-room.tsx",
] as const;

test("both gift surfaces say it, rather than showing the raw body", () => {
  for (const rel of rooms) {
    const source = readFileSync(`${root}${rel}`, "utf8");
    assert.match(source, /tipAlreadyInFlight\(error\)/u, `${rel} must handle the conflict`);
    assert.match(
      source,
      /nothing was charged/u,
      `${rel} must say nothing was charged — that is the fact the sender needs`
    );
  }
});

test("it never tells the sender to pay again", () => {
  /*
    The one thing this message must not do. A retry is refused before it
    reaches a wallet, so "try again" would send somebody in a circle — and
    after being charged three times for one tap earlier today, a false
    instruction to retry is the worst copy available.
  */
  for (const rel of rooms) {
    const source = readFileSync(`${root}${rel}`, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");
    const branch = source.slice(source.indexOf("tipAlreadyInFlight(error)"));
    const message = /toast\.error\(\s*([\s\S]*?)\);/u.exec(branch);
    assert.ok(message, `${rel}: no message in the branch`);
    assert.doesNotMatch(message[1], /try again|retry/iu, `${rel}: must not promise a retry that is refused`);
  }
});
