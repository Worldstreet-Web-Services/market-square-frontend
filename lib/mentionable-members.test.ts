import assert from "node:assert/strict";
import { test } from "node:test";
import { mentionCandidates, mentionableMembers, memberMention } from "./mentionable-members.ts";

const ada = { id: "p1", displayName: "Ada Obi", username: "ada" };
const bayo = { id: "p2", displayName: "Bayo Adeyemi", username: "bayo_a" };
const me = { id: "me", displayName: "Me Myself", username: "me" };
const roster = [ada, bayo, me];

test("a roster row becomes the same Mention shape a post sends", () => {
  assert.deepEqual(memberMention(ada), { type: "profile", id: "p1", label: "Ada Obi", handle: "ada" });
});

test("a bare query lists every member but the reader", () => {
  assert.deepEqual(
    mentionableMembers(roster, "", "me").map((m) => m.id),
    ["p1", "p2"]
  );
});

test("the query matches a handle, a name, or any word of the name", () => {
  // "ad" opens Ada's handle AND "Adeyemi", Bayo's second word; the handle ranks first.
  assert.deepEqual(mentionableMembers(roster, "ad", "me").map((m) => m.handle), ["ada", "bayo_a"]);
  assert.deepEqual(mentionableMembers(roster, "ade", "me").map((m) => m.handle), ["bayo_a"]);
  assert.deepEqual(mentionableMembers(roster, "BAYO", "me").map((m) => m.handle), ["bayo_a"]);
  assert.deepEqual(mentionableMembers(roster, "zzz", "me"), []);
});

test("handle matches rank ahead of name matches", () => {
  const rows = [
    { id: "a", displayName: "Bee Person", username: "zed" },
    { id: "b", displayName: "Someone", username: "bee" },
  ];
  assert.deepEqual(mentionableMembers(rows, "be").map((m) => m.id), ["b", "a"]);
});

test("server rows that are members lead, non-members are dropped", () => {
  const found = [
    { type: "profile" as const, id: "p2", label: "Bayo (server)", handle: "bayo_a" },
    { type: "profile" as const, id: "stranger", label: "Not Here", handle: "nothere" },
    { type: "group" as const, id: "g1", label: "A group", handle: "group" },
  ];
  const out = mentionCandidates({ found, members: roster, query: "", exclude: "me" });
  assert.deepEqual(
    out.map((m) => [m.id, m.label]),
    [
      ["p2", "Bayo (server)"],
      ["p1", "Ada Obi"],
    ]
  );
});

test("a 1:1 offers exactly the other party, whatever the search answered", () => {
  const out = mentionCandidates({ found: [], members: [ada, me], query: "", exclude: "me" });
  assert.deepEqual(out.map((m) => m.id), ["p1"]);
  // …and never the reader, even when the server returns them.
  const self = mentionCandidates({
    found: [{ type: "profile", id: "me", label: "Me", handle: "me" }],
    members: [ada, me],
    query: "me",
    exclude: "me",
  });
  assert.deepEqual(self, []);
});

test("the list is capped like the search", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, displayName: `M ${i}`, username: `m${i}` }));
  assert.equal(mentionCandidates({ found: [], members: many, query: "" }).length, 8);
  assert.equal(mentionCandidates({ found: [], members: many, query: "", max: 3 }).length, 3);
});
