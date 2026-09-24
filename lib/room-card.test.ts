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

/*
  ─── THE FALLBACK ORDER IS THE FEATURE ──────────────────────────────────────

  This function exists to replace a link with a picture. If the link fallback
  fires before the download, a desktop browser — which has `share` and refuses
  files — takes it EVERY TIME, succeeds, and quietly shares the very thing the
  card was built to replace. That is what happened, and it read as a dead
  button rather than as a wrong result.
*/
import { shareCardImage } from "./share-card-image.ts";

const PNG = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
const okFetch = (async () => new Response(PNG, { status: 200 })) as unknown as typeof fetch;

test("a browser that refuses FILES saves the card rather than sharing a link", async () => {
  const shared: unknown[] = [];
  const clicks: string[] = [];
  const doc = { createElement: () => ({ set href(_v: string) {}, download: "", click: () => clicks.push("x") }) };
  const original = globalThis.document;
  (globalThis as { document?: unknown }).document = doc;
  try {
    const outcome = await shareCardImage(
      { imageUrl: "/card", fileName: "a.png", url: "https://x.test/r" },
      {
        navigatorImpl: {
          share: async (p: unknown) => void shared.push(p),
          canShare: () => false, // desktop: has share, refuses files
        } as unknown as Navigator,
        fetchImpl: okFetch,
        createObjectURL: () => "blob:x",
      }
    );
    assert.equal(outcome, "downloaded", "a link was shared instead of the card being saved");
    assert.equal(shared.length, 0, "it shared a URL when it should have saved the picture");
    assert.equal(clicks.length, 1);
  } finally {
    (globalThis as { document?: unknown }).document = original;
  }
});

test("a browser that takes files shares the picture", async () => {
  const shared: { files?: unknown[] }[] = [];
  const outcome = await shareCardImage(
    { imageUrl: "/card", fileName: "a.png", url: "https://x.test/r" },
    {
      navigatorImpl: {
        share: async (p: { files?: unknown[] }) => void shared.push(p),
        canShare: () => true,
      } as unknown as Navigator,
      fetchImpl: okFetch,
      createObjectURL: () => "blob:x",
    }
  );
  assert.equal(outcome, "shared");
  assert.equal(shared[0]?.files?.length, 1, "the file was not attached");
});

test("a dismissed sheet is a cancel, not a failure", async () => {
  // Telling somebody it broke when they pressed cancel is the app arguing
  // with them.
  const abort = Object.assign(new Error("no"), { name: "AbortError" });
  const outcome = await shareCardImage(
    { imageUrl: "/card", fileName: "a.png", url: "https://x.test/r" },
    {
      navigatorImpl: {
        share: async () => {
          throw abort;
        },
        canShare: () => true,
      } as unknown as Navigator,
      fetchImpl: okFetch,
      createObjectURL: () => "blob:x",
    }
  );
  assert.equal(outcome, "cancelled");
});

test("no picture at all still shares the link", async () => {
  // The last resort is reachable, but only when there is genuinely nothing to
  // attach — a card the route could not render.
  const outcome = await shareCardImage(
    { imageUrl: "/card", fileName: "a.png", url: "https://x.test/r" },
    {
      navigatorImpl: { share: async () => {} } as unknown as Navigator,
      fetchImpl: (async () => new Response("no", { status: 500 })) as unknown as typeof fetch,
      createObjectURL: () => "blob:x",
    }
  );
  assert.equal(outcome, "linked");
});
