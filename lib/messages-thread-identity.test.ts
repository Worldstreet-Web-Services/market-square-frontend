import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isGroupThread,
  lastActiveLabel,
  memberCountLabel,
  threadSubtitleParts,
  threadTitle,
  type ThreadIdentity,
} from "../features/messages/lib/thread-identity.ts";

const NOW = new Date(2026, 8, 3, 15, 0).getTime(); // 3 September 2026, local
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const direct = (over: Partial<ThreadIdentity> = {}): ThreadIdentity => ({
  kind: "direct",
  peer: { displayName: "Fatima B.", username: "fatima.b", lastSeenAt: ago(20 * MINUTE) },
  ...over,
});

const group = (over: Partial<ThreadIdentity> = {}): ThreadIdentity => ({
  kind: "group",
  title: "Naija Tech Bros in Diaspora",
  memberCount: 75,
  lastActiveAt: ago(3 * DAY),
  ...over,
});

test("the two nodes' own header lines come out verbatim", () => {
  assert.equal(threadTitle(direct()), "Fatima B.");
  assert.deepEqual(threadSubtitleParts(direct(), NOW), ["@fatima.b", "Active 20m ago"]);

  assert.equal(threadTitle(group()), "Naija Tech Bros in Diaspora");
  assert.deepEqual(threadSubtitleParts(group(), NOW), ["75 members", "Active 3d ago"]);
});

test("an untitled group is named by the members the payload actually sent", () => {
  // The service caps `members` at four, so this is a preview roster and not
  // the membership — but the names in it are real, which a generic label is
  // not.
  assert.equal(
    threadTitle(
      group({
        title: null,
        members: [
          { displayName: "Ada", username: "ada" },
          { displayName: "Kwame", username: "kwame" },
        ],
      })
    ),
    "Ada, Kwame"
  );

  // Neither a title nor a roster is the only case that earns a generic word,
  // and a header with no text at all reads as a failed load.
  assert.equal(threadTitle(group({ title: null, members: [] })), "Group chat");
  assert.equal(threadTitle(group({ title: "   ", members: [] })), "Group chat");
});

test("a missing field drops its own half of the subtitle and nothing else", () => {
  // No presence: the handle stands alone rather than gaining "Active recently".
  assert.deepEqual(threadSubtitleParts(direct({ peer: { displayName: "Fatima B.", username: "fatima.b" } }), NOW), [
    "@fatima.b",
  ]);
  // No count: presence stands alone rather than gaining "0 members".
  assert.deepEqual(threadSubtitleParts(group({ memberCount: null }), NOW), ["Active 3d ago"]);
  // Neither: the line is not drawn at all.
  assert.deepEqual(
    threadSubtitleParts(group({ memberCount: null, lastActiveAt: null }), NOW),
    []
  );
  assert.deepEqual(threadSubtitleParts(direct({ peer: null }), NOW), []);
});

test("presence steps through minutes, hours, days and weeks", () => {
  assert.equal(lastActiveLabel(ago(10_000), NOW), "Active now");
  assert.equal(lastActiveLabel(ago(MINUTE), NOW), "Active 1m ago");
  assert.equal(lastActiveLabel(ago(59 * MINUTE), NOW), "Active 59m ago");
  assert.equal(lastActiveLabel(ago(HOUR), NOW), "Active 1h ago");
  assert.equal(lastActiveLabel(ago(23 * HOUR), NOW), "Active 23h ago");
  assert.equal(lastActiveLabel(ago(DAY), NOW), "Active 1d ago");
  assert.equal(lastActiveLabel(ago(6 * DAY), NOW), "Active 6d ago");
  assert.equal(lastActiveLabel(ago(7 * DAY), NOW), "Active 1w ago");
  assert.equal(lastActiveLabel(ago(34 * DAY), NOW), "Active 4w ago");
});

test("presence goes quiet past a month, and on anything unreadable", () => {
  // "Active" is a presence signal; past a month it stops being news and the
  // subtitle simply loses its second half.
  assert.equal(lastActiveLabel(ago(60 * DAY), NOW), null);
  assert.equal(lastActiveLabel(null, NOW), null);
  assert.equal(lastActiveLabel(undefined, NOW), null);
  assert.equal(lastActiveLabel("", NOW), null);
  assert.equal(lastActiveLabel("not-a-date", NOW), null);
});

test("a timestamp from the future is clock skew, not a prediction", () => {
  assert.equal(lastActiveLabel(new Date(NOW + 5 * MINUTE).toISOString(), NOW), "Active now");
});

test("the member count is absent, singular or plural — never a fabricated zero", () => {
  assert.equal(memberCountLabel(null), null);
  assert.equal(memberCountLabel(undefined), null);
  assert.equal(memberCountLabel(-1), null);
  assert.equal(memberCountLabel(Number.NaN), null);
  // An empty group is a real, if odd, answer and says so.
  assert.equal(memberCountLabel(0), "0 members");
  assert.equal(memberCountLabel(1), "1 member");
  assert.equal(memberCountLabel(75), "75 members");
});

test("kind is the only thing that decides which thread this is", () => {
  assert.equal(isGroupThread({ kind: "group" }), true);
  assert.equal(isGroupThread({ kind: "direct" }), false);
});

/*
  THE INBOX ROW USES THIS TOO, and that is the point of these three.

  The row had its own naming — `peer.displayName ?? "Unknown"` — written before
  groups existed. A group has NO peer by design, so every group in the inbox
  rendered as "Unknown". One rule, two surfaces, and a name is never invented.
*/
test("a group is never 'Unknown' — it falls back through title, members, then a real word", () => {
  assert.equal(
    threadTitle({ kind: "group", title: "Naija Tech Bros in Diaspora", peer: null }),
    "Naija Tech Bros in Diaspora",
  );
  // No title: the people in it are a truthful name.
  assert.equal(
    threadTitle({
      kind: "group",
      title: null,
      peer: null,
      members: [
        { username: "ada", displayName: "Ada" },
        { username: "bola", displayName: "Bola" },
      ],
    }),
    "Ada, Bola",
  );
  // Nothing at all still says what it IS, never "Unknown".
  assert.equal(threadTitle({ kind: "group", title: null, peer: null }), "Group chat");
  assert.equal(threadTitle({ kind: "group", title: "   ", peer: null }), "Group chat");
});

test("a direct thread is named by its peer, and never by a group fallback", () => {
  assert.equal(
    threadTitle({ kind: "direct", title: null, peer: { username: "fatima.b", displayName: "Fatima Bello" } }),
    "Fatima Bello",
  );
  assert.equal(threadTitle({ kind: "direct", title: null, peer: null }), "Conversation");
});
