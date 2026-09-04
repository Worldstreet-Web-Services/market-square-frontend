import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesQuery, tabQuery, visibleConversations } from "../features/messages/lib/filter.ts";

type Row = Parameters<typeof matchesQuery>[0];

const row = (over: Partial<Row> = {}): Row =>
  ({
    id: "c1",
    peer: {
      id: "p1",
      username: "kwame",
      displayName: "Kwame Mensah",
      verification: "verified",
    },
    lastMessage: { id: "m1", text: "Hi Balotelli, what's up with the market", senderId: "p1" },
    lastMessageAt: "2026-08-31T10:00:00.000Z",
    unreadCount: 0,
    ...over,
  }) as unknown as Row;

test("an empty query matches everything, so clearing the box restores the list", () => {
  assert.equal(matchesQuery(row(), ""), true);
  assert.equal(matchesQuery(row(), "   "), true);
});

test("matches display name, handle and message text, case-insensitively", () => {
  assert.equal(matchesQuery(row(), "kwame"), true);
  assert.equal(matchesQuery(row(), "KWAME"), true);
  assert.equal(matchesQuery(row(), "mensah"), true);
  assert.equal(matchesQuery(row(), "balotelli"), true);
  assert.equal(matchesQuery(row(), "zebra"), false);
});

test("survives a conversation with no peer and no last message", () => {
  // Both are nullable in the served contract; a search box must not be the
  // thing that throws on a half-populated row.
  const bare = row({ peer: null, lastMessage: null } as Partial<Row>);
  assert.equal(matchesQuery(bare, ""), true);
  assert.equal(matchesQuery(bare, "anything"), false);
});

test("the unread filter keeps only unread conversations", () => {
  const rows = [row({ id: "a", unreadCount: 0 }), row({ id: "b", unreadCount: 3 })];
  assert.deepEqual(
    visibleConversations(rows, "unread", "").map((r) => r.id),
    ["b"]
  );
  assert.deepEqual(
    visibleConversations(rows, "all", "").map((r) => r.id),
    ["a", "b"]
  );
});

test("filter and search compose — both must pass", () => {
  const rows = [
    row({ id: "a", unreadCount: 2 }),
    row({
      id: "b",
      unreadCount: 2,
      peer: { id: "p2", username: "lena", displayName: "Lena Moreau" },
    } as Partial<Row>),
  ];
  assert.deepEqual(
    visibleConversations(rows, "unread", "lena").map((r) => r.id),
    ["b"]
  );
});

test("tabQuery asks the SERVER for each tab, rather than slicing one list", () => {
  // Client-side slicing would make "Houses" mean "the groups among the last 30
  // conversations" — a different, and quietly wrong, statement.
  assert.deepEqual(tabQuery("all"), {});
  assert.deepEqual(tabQuery("gists"), { kind: "direct" });
  assert.deepEqual(tabQuery("houses"), { kind: "group" });
  assert.deepEqual(tabQuery("requests"), { state: "pending" });
});

test("tabQuery never sends a state for the three accepted tabs", () => {
  // The service defaults `state` to accepted. A pending request must not reach
  // the ordinary inbox because a client passed one explicitly.
  for (const tab of ["all", "gists", "houses"] as const) {
    assert.equal("state" in tabQuery(tab), false, tab);
  }
});
