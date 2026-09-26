import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/*
  EVERY KIND THIS CLIENT LISTS MUST ALSO BE DRAWN.

  `NotificationKindSchema` ends in `.catch("follow")`, so a kind the enum has
  not heard of does not fail — it becomes "X started following you". That has
  shipped three times (`tip_received`, `wink`, and four kinds at once), and
  each time somebody was told the wrong thing about their own account: a
  creator who had been PAID was told they had gained a follower.

  The enum's own notes draw the right lesson — list a kind before the service
  sends it — and `gift_received` was added that way, ahead of service #317.
  This covers the OTHER half of the same hole: a kind listed in the enum but
  never given a case falls to the switch default, which is the same silent
  mislabelling arriving by a different door.

  It cannot check what the service actually sends; nothing in this repo can.
  That half stays a habit: re-read the service's kind union whenever
  notifications change.
*/

const root = new URL("..", import.meta.url).pathname;
const types = readFileSync(`${root}features/notifications/lib/types.ts`, "utf8");
const page = readFileSync(`${root}features/notifications/components/notifications-page.tsx`, "utf8");

/** The kinds the enum lists, read out of the schema rather than re-typed. */
function listedKinds(): string[] {
  const start = types.indexOf("NotificationKindSchema");
  assert.notEqual(start, -1, "NotificationKindSchema has been renamed");
  const block = types.slice(start, types.indexOf("])", start));
  return [...new Set(block.match(/"[a-z_]+"/gu)?.map((q) => q.slice(1, -1)) ?? [])];
}

test("every listed notification kind has its own words", () => {
  const kinds = listedKinds();
  // If this collapses the matcher has stopped matching and the test asserts
  // nothing — the failure mode that lets a broken guard pass forever.
  assert.ok(kinds.length >= 20, `only ${kinds.length} kinds found; the matcher is not matching`);

  const drawn = new Set([...page.matchAll(/case "([a-z_]+)":/gu)].map((match) => match[1]));
  const undrawn = kinds.filter((kind) => !drawn.has(kind));
  assert.deepEqual(
    undrawn,
    [],
    `these fall to the switch default and will be shown as something they are not:\n  ${undrawn.join("\n  ")}`
  );
});

test("a gift is told apart from a tip and from a follow", () => {
  /*
    The three that are easiest to conflate and worst to conflate. A tip is an
    AMOUNT; a gift is an OBJECT somebody chose; a follow is neither and is what
    both become when the enum has not heard of them.
  */
  assert.ok(listedKinds().includes("gift_received"), "gift_received must be listed before #317 ships");
  assert.match(page, /case "gift_received":/u);

  const title = /case "gift_received":\s*\n\s*return "([^"]+)"/u.exec(page);
  assert.ok(title, "gift_received has no title of its own");
  assert.notEqual(title[1], "You were tipped", "a gift is not a tip");
  assert.doesNotMatch(title[1], /follow/iu);
});

test("the gift row does not name a gift it was never told", () => {
  /*
    The payload carries the sender, the room, and nothing else — no `giftId`
    and no amount. Copy or artwork naming one of the fourteen catalogue gifts
    would be this row inventing the thing somebody chose, which is exactly the
    detail a recipient would notice.
  */
  const body = /case "gift_received":[\s\S]{0,400}?return `([^`]+)`/u.exec(page);
  assert.ok(body, "gift_received has no body of its own");
  assert.doesNotMatch(body[1], /\bgift-\d|\brose\b|\blion\b/iu);

  const icon = /gift_received: asset\("([^"]+)"\)/u.exec(page);
  assert.ok(icon, "gift_received has no icon");
  assert.doesNotMatch(
    icon[1],
    /gift-\d+\.png/u,
    "a specific gift image would name a gift the payload never carried"
  );
});
