import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProfileSchema, SpeakerRequestSchema } from "./schemas.ts";
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

describe("SpeakerRequestSchema accepts the invite-to-speak fields before the backend sends them", () => {
  // A row exactly as GET /speaker-requests/me serves it today.
  const legacy = {
    id: "req_1",
    streamId: "str_1",
    userId: "did:privy:abc123",
    status: "pending",
    createdAt: "2026-09-17T10:00:00.000Z",
  };

  it("parses a legacy payload with every new field defaulted", () => {
    const parsed = SpeakerRequestSchema.parse(legacy);
    assert.equal(parsed.status, "pending");
    assert.equal(parsed.initiatedBy, "listener");
    assert.equal(parsed.expiresAt, null);
  });

  it("parses a host invitation with its expiry, which is inviteExpiresAt and never expiresAt", () => {
    // The service's field (wsws-monorepo market-square SpeakerRequest):
    // `expiresAt` on /me is the approved speaker's JOIN TOKEN expiry, so the
    // invitation's own clock has a name of its own.
    const parsed = SpeakerRequestSchema.parse({
      ...legacy,
      status: "invited",
      initiatedBy: "host",
      inviteExpiresAt: "2026-09-17T10:01:00.000Z",
      expiresAt: "2026-09-17T11:00:00.000Z",
    });
    assert.equal(parsed.status, "invited");
    assert.equal(parsed.initiatedBy, "host");
    assert.equal(parsed.inviteExpiresAt, "2026-09-17T10:01:00.000Z");
    assert.equal(parsed.expiresAt, "2026-09-17T11:00:00.000Z");
    assert.equal(SpeakerRequestSchema.parse(legacy).inviteExpiresAt, null);
  });

  it("carries no mute flags: the host's mute is the LiveKit attribute, and there is no hard mute", () => {
    const parsed = SpeakerRequestSchema.parse({ ...legacy, status: "approved", hostMuted: true, muteHard: true });
    assert.equal("hostMuted" in parsed, false);
    assert.equal("muteHard" in parsed, false);
  });

  it("still refuses an unknown status as a status: it never reaches the client as itself", () => {
    // The whole payload must still parse — a new status breaking /me is the
    // outage this widening exists to prevent — but the value is not accepted:
    // it falls to `pending`, as it always has, and never masquerades as
    // `invited` or `approved`.
    const parsed = SpeakerRequestSchema.parse({ ...legacy, status: "expired" });
    assert.equal(parsed.status, "pending");
    assert.equal(SpeakerRequestSchema.shape.status.safeParse("expired").data, "pending");
    assert.equal(SpeakerRequestSchema.parse({ ...legacy, initiatedBy: "robot" }).initiatedBy, "listener");
  });
});

describe("StreamSchema.audience fails closed", async () => {
  const { StreamSchema } = await import("./schemas.ts");
  const { mediaSessionMetadata, PRIVATE_ROOM_METADATA } = await import("../room-session/media-session.ts");
  const room = {
    id: "g1",
    ownerId: "did:privy:host",
    owner: base,
    title: "Late gist",
    status: "live",
    visibility: "public",
    houseConversationId: null,
  };

  it("a payload with no audience is NOT read as public", () => {
    const parsed = StreamSchema.parse(room);
    assert.notEqual(parsed.audience, "public");
    assert.deepEqual(mediaSessionMetadata(parsed), PRIVATE_ROOM_METADATA, "a room's topic reached the lock screen on a missing field");
  });

  it("an audience this client does not know is NOT read as public", () => {
    for (const audience of ["followers", "unlisted", 7, null]) {
      const parsed = StreamSchema.parse({ ...room, audience });
      assert.notEqual(parsed.audience, "public", String(audience));
      assert.deepEqual(mediaSessionMetadata(parsed), PRIVATE_ROOM_METADATA, String(audience));
    }
  });

  it("an explicit public or private is kept", () => {
    assert.equal(StreamSchema.parse({ ...room, audience: "public" }).audience, "public");
    assert.equal(StreamSchema.parse({ ...room, audience: "private" }).audience, "private");
    assert.deepEqual(mediaSessionMetadata(StreamSchema.parse({ ...room, audience: "public" })), { title: "Late gist", artist: "Amara Okafor" });
  });
});
