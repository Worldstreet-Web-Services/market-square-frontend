import test from "node:test";
import assert from "node:assert/strict";
import { parseRoomCard, roomCardQuery, roomCardFileName } from "./room-card.ts";

const q = (s: string) => new URLSearchParams(s);
const ROOM = "https://square.tsionark.com/gist-rooms/abc";

/*
  The share card's query is PUBLIC INPUT. Anybody can call the route with any
  string, and two of those strings become an `<img src>` inside a server-side
  renderer — so this parser is the boundary, not a convenience.
*/

test("a card needs somewhere to point and something to call it", () => {
  // Without a URL the QR encodes nothing and the card is decoration; without a
  // title there is nothing to invite anybody to.
  assert.equal(parseRoomCard(q("title=Daily+Devotion")), null);
  assert.equal(parseRoomCard(q(`url=${encodeURIComponent(ROOM)}`)), null);
  assert.ok(parseRoomCard(q(`url=${encodeURIComponent(ROOM)}&title=Daily`)));
});

test("only http(s) becomes an image the renderer will fetch", () => {
  /*
    These strings are fetched SERVER-SIDE. A `file:` URL there is the renderer
    reading the disk on behalf of whoever crafted the link, and a `data:` one
    is it decoding arbitrary bytes. Both are rejected rather than sanitised —
    there is no safe version of either on this route.
  */
  for (const bad of [
    "file:///etc/passwd",
    "data:image/png;base64,AAAA",
    "javascript:alert(1)",
    "not a url at all",
  ]) {
    const card = parseRoomCard(q(`url=${encodeURIComponent(ROOM)}&title=T&cover=${encodeURIComponent(bad)}`));
    assert.equal(card?.coverUrl, null, `${bad} was accepted as a cover`);
  }
  const ok = parseRoomCard(
    q(`url=${encodeURIComponent(ROOM)}&title=T&cover=${encodeURIComponent("https://cdn.example/x.png")}`)
  );
  assert.equal(ok?.coverUrl, "https://cdn.example/x.png");
});

test("the destination itself must be a real link", () => {
  // The `url` is what the QR encodes, so a `javascript:` there would be a
  // scannable script rather than an invitation.
  assert.equal(parseRoomCard(q("url=javascript%3Aalert(1)&title=T")), null);
});

test("strings are capped, so a crafted link cannot make the renderer work", () => {
  const long = "x".repeat(5000);
  const card = parseRoomCard(q(`url=${encodeURIComponent(ROOM)}&title=${long}&host=${long}`));
  assert.ok((card?.title.length ?? 0) <= 140);
  assert.ok((card?.hostName?.length ?? 0) <= 60);
});

test("blank is absent, not empty", () => {
  // A host of "" would draw "Hosted by" with nothing after it. Absent means
  // the line is not drawn at all.
  const card = parseRoomCard(q(`url=${encodeURIComponent(ROOM)}&title=T&host=%20%20`));
  assert.equal(card?.hostName, null);
});

test("the query round-trips through the parser", () => {
  // The client builds it and the route reads it; a key that only one side
  // knows about is a field that silently never arrives.
  const face = {
    url: ROOM,
    title: "Daily Devotion",
    startsAt: "2026-09-25T09:00:00Z",
    hostName: "Director Mike",
    hostAvatarUrl: "https://cdn.example/a.png",
    coverUrl: "https://cdn.example/c.png",
  };
  assert.deepEqual(parseRoomCard(q(roomCardQuery(face))), face);
});

test("the saved file is named after the ROOM", () => {
  // A gallery full of `square-card.png` helps nobody find the one they meant
  // to forward.
  assert.equal(roomCardFileName("Daily Devotion: Where It Begins"), "daily-devotion-where-it-begins-square.png");
  assert.equal(roomCardFileName("   "), "gist-room-square.png");
  assert.equal(roomCardFileName("!!!"), "gist-room-square.png");
});
