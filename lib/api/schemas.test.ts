import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProfileSchema } from "./schemas.ts";
import { readFileSync } from "node:fs";

// A minimal ProfileSummary as the service hydrates it.
const base = {
  id: "did:privy:abc123",
  username: "amara",
  displayName: "Amara Okafor",
  role: "creator",
  verification: "earned",
};

describe("ProfileSchema.orgBadge", () => {
  it("carries a market badge through", () => {
    assert.equal(ProfileSchema.parse({ ...base, orgBadge: "market" }).orgBadge, "market");
  });

  it("carries an ark badge through", () => {
    assert.equal(ProfileSchema.parse({ ...base, orgBadge: "ark" }).orgBadge, "ark");
  });

  it("defaults to null when the backend omits the field entirely", () => {
    // The badge shipped after this client did; an older payload must still
    // parse rather than throwing and blanking the whole surface.
    assert.equal(ProfileSchema.parse(base).orgBadge, null);
  });

  it("keeps an explicit null as null", () => {
    assert.equal(ProfileSchema.parse({ ...base, orgBadge: null }).orgBadge, null);
  });

  it("coerces an unknown badge to null rather than throwing", () => {
    // A future third badge must not break every profile that carries it —
    // rendering no chip is the safe degradation.
    assert.equal(ProfileSchema.parse({ ...base, orgBadge: "partner" }).orgBadge, null);
  });

  it("is independent of role — worldstreet does not imply a badge", () => {
    // The badge is assigned admin-only; deriving it from role would invent one.
    const parsed = ProfileSchema.parse({ ...base, role: "worldstreet" });
    assert.equal(parsed.role, "worldstreet");
    assert.equal(parsed.orgBadge, null);
  });

  it("co-exists with role, which stays untouched", () => {
    const parsed = ProfileSchema.parse({ ...base, role: "citizen", orgBadge: "ark" });
    assert.equal(parsed.role, "citizen");
    assert.equal(parsed.orgBadge, "ark");
  });
});

describe("ProfileSchema.verification", () => {
  const states = ["none", "pending", "verified", "lapsed"] as const;

  for (const state of states) {
    it(`carries "${state}" through`, () => {
      assert.equal(ProfileSchema.parse({ ...base, verification: state }).verification, state);
    });
  }

  it("coerces the retired 'earned' tier to none rather than throwing", () => {
    // The old enum was none|pending|earned|paid. A stale payload must degrade
    // to "no check" — never to a check the account no longer holds.
    assert.equal(ProfileSchema.parse({ ...base, verification: "earned" }).verification, "none");
  });

  it("coerces the retired 'paid' tier to none", () => {
    assert.equal(ProfileSchema.parse({ ...base, verification: "paid" }).verification, "none");
  });

  it("coerces an unknown state to none", () => {
    assert.equal(ProfileSchema.parse({ ...base, verification: "banned" }).verification, "none");
  });

  it("never carries billing fields on a public profile", () => {
    // Billing lives only on /me/verification. Even if a backend leaked these,
    // the profile schema must not surface them to other users' views.
    const parsed = ProfileSchema.parse({
      ...base,
      verification: "verified",
      paidThrough: "2026-01-01T00:00:00Z",
      daysRemaining: 9,
    }) as Record<string, unknown>;
    assert.equal(parsed.paidThrough, undefined);
    assert.equal(parsed.daysRemaining, undefined);
  });
});

/**
 * THE NOTIFICATION ENUM MUST COVER WHAT THE SERVICE SENDS.
 *
 * `NotificationKindSchema` ends in `.catch("follow")`, which is right — an
 * unknown future kind must not fail the whole page. But it means every kind
 * this enum has NOT heard of renders as "New Follower · X started following
 * you on Square", which is a lie about a thing that did not happen.
 *
 * It has now bitten three times: `tip_received` told a paid creator they had a
 * new follower, `wink` was listed pre-emptively for the same reason, and then
 * `message`, `chat_request`, `group_added` and `speaker_request` were all
 * being sent by the service and shown as follows — six, six and three rows of
 * it sitting in the local database.
 *
 * Read from SOURCE rather than imported: the notifications slice imports
 * through the `@/` alias, which Node's test runner does not resolve, which is
 * why every other cross-slice invariant in this repo is source-read too.
 *
 * Pins the served contract's list (:8094, checked 2026-09-08). When
 * notifications change upstream, re-read the enum and update BOTH.
 */
describe("notification kinds cover the served contract", () => {
  const SERVED = [
    "follow",
    "like",
    "comment",
    "repost",
    "bookmark",
    "ticket_purchased",
    "stream_live",
    "verification_resolved",
    "role_resolved",
    "message",
    "speaker_request",
    "tip_received",
    "wink",
    "chat_request",
    "group_added",
  ];

  const source = readFileSync(
    new URL("../../features/notifications/lib/types.ts", import.meta.url),
    "utf8"
  );
  /*
    Sliced on the enum's OWN brackets, not on `.catch("follow")`.

    The first attempt ended the slice at `indexOf('.catch("follow")')` — and
    the comments in that file quote that exact string while explaining the bug,
    so the block was truncated inside prose and `stream_live` read as missing.
    A test that fails for the wrong reason is barely better than one that
    passes for the wrong reason.
  */
  const start = source.indexOf(".enum([", source.indexOf("NotificationKindSchema"));
  const enumBlock = source.slice(start, source.indexOf("])", start));

  it("lists every kind the service sends, so none renders as a follow", () => {
    for (const kind of SERVED) {
      assert.ok(
        enumBlock.includes(`"${kind}"`),
        `"${kind}" is missing — .catch("follow") would render it as a follow that never happened`
      );
    }
  });

  it("still degrades an unknown future kind rather than failing the page", () => {
    assert.match(source, /\.catch\("follow"\)/);
  });
});

describe("ProfileSchema.username picks the handle to route and print by", () => {
  // "user_" + eight of the room-code alphabet, which excludes 0/O/1/l/I.
  const minted = "user_kmvvbmrf";

  it("prefers the handle the person chose", () => {
    const p = ProfileSchema.parse({ ...base, username: "amara", generatedUsername: minted });
    assert.equal(p.username, "amara");
  });

  it("uses the minted handle when nothing was chosen", () => {
    const p = ProfileSchema.parse({ ...base, username: null, generatedUsername: minted });
    assert.equal(p.username, minted);
  });

  it("STILL falls back to the id when the mint is not deployed", () => {
    // The key is absent, not null, on a service running the older build. This
    // line is the only reason unclaimed profiles route at all until it ships.
    const p = ProfileSchema.parse({ ...base, username: null });
    assert.equal(p.username, base.id);
  });

  it("does not let a minted handle pass for a chosen one", () => {
    // The claim screen keys off this. A handle the service handed out is not
    // an answer to "what do you want to be called".
    const p = ProfileSchema.parse({ ...base, username: null, generatedUsername: minted });
    assert.equal(p.usernameUnclaimed, true);
    const chosen = ProfileSchema.parse({ ...base, username: "amara" });
    assert.equal(chosen.usernameUnclaimed, false);
  });

  it("does not read a minted handle as somebody's name", () => {
    // "user_kmvvbmrf" is an address; naming a person that says the machine
    // named them. A chosen handle DOES stand in for a missing name.
    const given = ProfileSchema.parse({
      ...base,
      username: null,
      displayName: null,
      generatedUsername: minted,
    });
    assert.equal(given.displayName, "Member ·C123");
    const chose = ProfileSchema.parse({ ...base, username: "amara", displayName: null });
    assert.equal(chose.displayName, "amara");
  });
});
