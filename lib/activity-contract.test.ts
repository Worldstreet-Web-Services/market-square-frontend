import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { buildCreateActivityBody } from "./activity-payload.ts";

/**
 * POST /activities, copied VERBATIM from the service's own validator
 * (apps/market-square/src/controllers/schemas.ts → createActivityBodySchema).
 *
 * The production bug this pins: `deepLink` has no `.optional()`, but our form
 * labelled it "Link ref (stream id, game id — optional)" and sent nothing when
 * left blank. Every such activity was rejected with
 *   400 deepLink: Invalid input: expected object, received undefined
 * so the table stayed empty and Upcoming had nothing to show.
 *
 * Keep this schema in step with the service. If the backend relaxes deepLink
 * to optional, this test is where that decision gets recorded.
 */
const deepLinkSchema = z.object({
  kind: z.enum(["stream", "store_item", "listing", "market", "game", "external"]),
  ref: z.string().min(1).max(500),
});

const createActivityBodySchema = z.object({
  type: z.enum(["game", "stream", "event"]),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startsAt: z.string().datetime(),
  deepLink: deepLinkSchema,
});

const accepts = (body: unknown) => createActivityBodySchema.safeParse(body).success;
const firstIssue = (body: unknown) => {
  const result = createActivityBodySchema.safeParse(body);
  return result.success ? null : result.error.issues[0].path.join(".");
};

describe("the create-activity payload satisfies the service contract", () => {
  // What the form now builds from a datetime-local value and a picked link.
  const valid = buildCreateActivityBody({
    type: "stream",
    title: "Chess: round 3",
    localStartsAt: "2026-09-01T10:00",
    deepLink: { kind: "stream", ref: "01a03a7a" },
  });

  it("is accepted as-is", () => {
    assert.ok(accepts(valid), JSON.stringify(createActivityBodySchema.safeParse(valid), null, 2));
  });

  it("sends startsAt as a full ISO-8601 datetime, not a date", () => {
    // A <input type="date"> value ("2026-09-01") fails z.string().datetime().
    assert.match(valid.startsAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    assert.equal(firstIssue({ ...valid, startsAt: "2026-09-01" }), "startsAt");
  });

  it("always includes deepLink — the field is REQUIRED", () => {
    assert.ok(valid.deepLink, "the form must not be able to submit without one");
    assert.equal(
      firstIssue({ ...valid, deepLink: undefined }),
      "deepLink",
      "this is the exact 400 that silently emptied the activities table"
    );
  });

  it("refuses to build a payload with no link at all", () => {
    // The guard lives in the builder so no caller can reintroduce the bug by
    // forgetting to check before calling mutate().
    assert.throws(
      () =>
        buildCreateActivityBody({
          type: "stream",
          title: "x",
          localStartsAt: "2026-09-01T10:00",
          deepLink: null,
        }),
      /deepLink/
    );
  });

  it("only emits deepLink kinds the service accepts", () => {
    // `type` allows "event" but deepLink.kind does NOT — mapping one onto the
    // other, as the old form did, produced an invalid kind.
    for (const kind of ["stream", "store_item", "listing", "market", "game", "external"] as const) {
      assert.ok(accepts({ ...valid, deepLink: { kind, ref: "r" } }), kind);
    }
    assert.equal(firstIssue({ ...valid, deepLink: { kind: "event", ref: "r" } }), "deepLink.kind");
  });

  it("omits description rather than sending an empty string", () => {
    const withBlank = buildCreateActivityBody({
      type: "event",
      title: "x",
      localStartsAt: "2026-09-01T10:00",
      deepLink: { kind: "external", ref: "https://example.com" },
      description: "   ",
    });
    assert.equal(withBlank.description, undefined);
    assert.ok(accepts(withBlank));
  });
});
