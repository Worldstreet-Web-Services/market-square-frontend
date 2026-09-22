import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALWAYS_ON_GROUP,
  GROUP_LABEL,
  NOTIFICATION_GROUPS,
  PUSH_GROUP_HINT,
  PUSH_GROUP_ORDER,
  pushGroupRows,
} from "./notification-groups.ts";

const ALL = { social: true, money: true, rooms: true, chat: true, account: true };

describe("the buckets themselves", () => {
  it("names and describes every one the service can send", () => {
    // A group with no label renders as nothing; with no hint, as a switch
    // whose meaning the reader has to guess.
    for (const group of NOTIFICATION_GROUPS) {
      assert.ok(GROUP_LABEL[group]?.length, `${group} has no label`);
      assert.ok(PUSH_GROUP_HINT[group]?.length, `${group} has no hint`);
    }
  });

  it("orders all of them, and only them", () => {
    // A group missing from the order silently loses its switch — the same
    // class of bug as a kind missing from an enum, which this repo has
    // shipped three times.
    assert.deepEqual([...PUSH_GROUP_ORDER].sort(), [...NOTIFICATION_GROUPS].sort());
    assert.equal(PUSH_GROUP_ORDER[0], "chat", "the one you must not switch off by accident reads first");
  });

  it("describes a bucket by theme, never by listing its kinds", () => {
    /*
      A list of kinds in the copy would be a kind-to-group map in prose — the
      thing this module exists to keep on the server — and it would go stale
      silently the first time one moved. These are the two kinds whose
      misrendering actually shipped.
    */
    const copy = Object.values(PUSH_GROUP_HINT).join(" ");
    assert.doesNotMatch(copy, /tip_received|comment_reply|post_announced|stream_live/);
  });
});

describe("the rows under the push switch", () => {
  it("draws nothing at all until the service sends the buckets", () => {
    // An absent capability shows nothing. Five permanently dead switches
    // under a working one is not a reason, it is clutter.
    assert.deepEqual(pushGroupRows({ groups: undefined, pushOn: true, pushUsable: true }), []);
  });

  it("reads each bucket from what the service stored", () => {
    const rows = pushGroupRows({
      groups: { ...ALL, social: false, rooms: false },
      pushOn: true,
      pushUsable: true,
    });
    const byGroup = Object.fromEntries(rows.map((row) => [row.group, row]));
    assert.equal(byGroup.social.checked, false);
    assert.equal(byGroup.rooms.checked, false);
    assert.equal(byGroup.chat.checked, true);
    assert.equal(byGroup.chat.disabled, false);
  });

  it("cannot be tuned while the device receives nothing", () => {
    // Narrowing what arrives is meaningless when nothing arrives, and a live
    // switch there would imply the phone is reachable when it is not.
    const off = pushGroupRows({ groups: ALL, pushOn: false, pushUsable: true });
    assert.ok(off.every((row) => row.disabled));
    const unusable = pushGroupRows({ groups: ALL, pushOn: true, pushUsable: false });
    assert.ok(unusable.every((row) => row.disabled));
  });

  it("shows the undeclinable bucket as on, whatever is stored", () => {
    /*
      `account`'s only pushable kind is an admin broadcasting your post. The
      author did not choose it and cannot decline it — "you are the last to
      know" is the failure the push exists to prevent — so the row must not
      offer a switch that the service will ignore. Verification and role
      decisions are in this group too and have never pushed at all.
    */
    const rows = pushGroupRows({ groups: { ...ALL, account: false }, pushOn: true, pushUsable: true });
    const account = rows.find((row) => row.group === ALWAYS_ON_GROUP);
    assert.equal(account?.checked, true, "a stored false must not read as off");
    assert.equal(account?.disabled, true);
    assert.match(account?.description ?? "", /Always on/);
  });

  it("returns one row per bucket, in the settings order", () => {
    const rows = pushGroupRows({ groups: ALL, pushOn: true, pushUsable: true });
    assert.deepEqual(
      rows.map((row) => row.group),
      [...PUSH_GROUP_ORDER]
    );
  });
});
