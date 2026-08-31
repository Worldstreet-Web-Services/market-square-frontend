import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const hook = source("features/streams/hooks/use-streams.ts");

test("a ticket carrying a wallet is not paid for yet", () => {
  // The presence of `toWallet` IS the instruction to sign. Treating a pending
  // ticket as bought is how a buyer gets locked out of a stream they think
  // they paid for.
  assert.match(hook, /if \(!created\.toWallet \|\| created\.status === "confirmed"\) return created;/);
});

test("the hash is recorded BEFORE the confirmation wait", () => {
  // From the moment the transfer is broadcast, the only thing that makes a
  // retry safe is that the hash was written down first. Recording it after the
  // wait would leave a paid buyer with no record and a retry that pays twice.
  const holdAt = hook.indexOf('holdPayment("ticket"');
  const waitAt = hook.indexOf("waitForReceipt(txHash");
  assert.ok(holdAt > 0, "the ticket payment must be held");
  assert.ok(waitAt > 0, "the receipt must be awaited");
  assert.ok(holdAt < waitAt, "the hash must be held before the receipt wait");
});

test("a reverted transfer is never reported as payment", () => {
  assert.match(hook, /if \(outcome === "reverted"\)[\s\S]{0,200}clearHeldPayment\("ticket", wallet\)/);
  assert.match(hook, /Nothing was sent\./);
});

test("tickets hold payments in their OWN namespace", () => {
  // A stranded tip must never be replayable as a ticket.
  assert.match(hook, /heldPayment\("ticket", wallet, key\)/);
  assert.doesNotMatch(hook, /heldPayment\("tip", wallet/);
});

test("a pending ticket is never announced as confirmed", () => {
  // The chain has not settled it, so the buyer cannot open the stream yet.
  assert.match(hook, /ticket\.status === "confirmed"[\s\S]{0,120}unlocks once it confirms/);
});

test("the transfer path is written inline so the route checker sees it", () => {
  // A path assembled into a variable is invisible to check:public-routes,
  // which is how a route that does not exist upstream reaches production.
  const api = source("features/streams/lib/api.ts");
  assert.match(api, /`\/streams\/\$\{streamId\}\/tickets\/\$\{ticketId\}\/transfer`/);
});
