import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProfileSettingsSchema } from "../features/settings/lib/types.ts";

const base = {
  notifications: { friendsRooms: true, direct: true, push: true },
  chat: { messagesFrom: "everyone", allowHouseMembers: true, allowPastAudience: true },
};
const FIVE = { social: true, money: true, rooms: true, chat: true, account: true };

const parse = (pushGroups: unknown) =>
  ProfileSettingsSchema.parse({ ...base, notifications: { ...base.notifications, pushGroups } });

describe("the push buckets on /me/settings", () => {
  it("is absent on a service that does not have them", () => {
    // Absent is the whole staging signal: Settings draws no rows at all.
    const settings = ProfileSettingsSchema.parse(base);
    assert.equal(settings.notifications.pushGroups, undefined);
  });

  it("takes all five, as booleans", () => {
    assert.deepEqual(parse(FIVE).notifications.pushGroups, FIVE);
  });

  it("refuses a partial set rather than defaulting the rest", () => {
    /*
      The service stores a column per group and always answers with all five,
      so a partial object is a contract break. Defaulting the missing ones
      would show somebody a switch reading ON while the service believed
      otherwise — wrong for one person at a time and visible to nobody.
    */
    assert.throws(() => parse({ social: true }));
    assert.throws(() => parse({ ...FIVE, account: undefined }));
  });

  it("refuses a value that is not a boolean", () => {
    assert.throws(() => parse({ ...FIVE, chat: "yes" }));
    assert.throws(() => parse({ ...FIVE, chat: null }));
  });

  it("CARRIES A SIXTH BUCKET THROUGH UNTOUCHED", () => {
    /*
      THE DEPLOY-ORDERING TRAP THIS EXISTS TO AVOID.

      This object is the one thing read and written back WHOLE: a save spreads
      what was read and replaces one key, because the service refuses a
      partial `pushGroups`. Strict parsing would strip a bucket we have not
      heard of, so the day a sixth ships, the client would read six, keep five
      and send five — and every push-group save would 400 until the frontend
      caught up. It would arrive as "saving my notifications is broken", with
      nothing in the frontend having changed.

      Loose keeps the unknown key, so the save stays complete. Only the ROW is
      missing until we add one, which is a gap the reader can live with.
    */
    const withSixth = { ...FIVE, commerce: false };
    const parsed = parse(withSixth);
    assert.deepEqual(parsed.notifications.pushGroups, withSixth);
    // …and the save, which spreads what was read, still sends all six.
    const saved = { ...parsed.notifications.pushGroups, chat: false };
    assert.equal(Object.keys(saved).length, 6);
    assert.equal(saved.commerce, false);
  });
});
