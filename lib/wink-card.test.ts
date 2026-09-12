import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { artworkForSeed, resolveSeed } from "./avatar-seed.ts";
import { friendsMomentCopy, friendsMomentLabels, type FriendsMomentKind } from "./friends-popup.ts";
import { parseWinkCard, safePhoto, winkCardFileName, winkCardQuery, type WinkCardInput } from "./wink-card.ts";

const FOLA = { id: "did:privy:fola", username: "fola", displayName: "Fola Ade", avatarUrl: null };
const ME = { id: "did:privy:me", username: "ogazboiz", displayName: "ogazboiz", avatarUrl: "https://cdn.example/me.jpg" };

const roundTrip = (input: WinkCardInput) => {
  const card = parseWinkCard(new URLSearchParams(winkCardQuery(input)));
  assert.ok(card, "a card that names a person parses");
  return card;
};

describe("the saved wink card says what the popup says", () => {
  for (const kind of ["friends", "mutual-wink", "wink"] as FriendsMomentKind[]) {
    for (const isFollowing of [true, false]) {
      it(`${kind}, following=${isFollowing}: same copy and labels as the popup`, () => {
        const other = { ...FOLA, isFollowing };
        const card = roundTrip({ kind, other, viewer: ME });
        const popup = friendsMomentCopy({ kind, actor: other, notificationIds: [] }, "Fola Ade");
        assert.deepEqual(card.copy, popup);
        assert.deepEqual(card.labels, friendsMomentLabels(popup, "Fola Ade"));
      });
    }
  }

  it("carries both faces, with the viewer's photo and the other's seeded mascot", () => {
    const card = roundTrip({ kind: "friends", other: FOLA, viewer: ME });
    assert.equal(card.viewer.photo, "https://cdn.example/me.jpg");
    assert.equal(card.other.photo, null);
    // The popup's <Avatar name seed={id}> — id first, then name.
    assert.equal(card.other.artwork, artworkForSeed(resolveSeed({ id: FOLA.id, name: "Fola Ade" })));
  });

  it("names a person by display name, else username", () => {
    assert.equal(roundTrip({ kind: "wink", other: { ...FOLA, displayName: "" }, viewer: ME }).other.name, "fola");
  });

  it("refuses a link that names nobody instead of drawing Someone", () => {
    assert.equal(parseWinkCard(new URLSearchParams("k=wink")), null);
    assert.equal(parseWinkCard(new URLSearchParams("")), null);
    assert.equal(parseWinkCard(new URLSearchParams("k=friends&on=%20%20&ou=")), null);
  });

  it("reads the link's first shape (?name&handle&avatar) as the wink it drew", () => {
    const card = parseWinkCard(new URLSearchParams("name=prince&handle=prince&avatar=https://cdn.example/p.png"));
    assert.equal(card!.other.name, "prince");
    assert.equal(card!.other.photo, "https://cdn.example/p.png");
    assert.equal(card!.username, "prince");
    assert.equal(card!.copy.faces, "theirs");
    assert.equal(card!.labels.primary, "Wink back");
  });
});

describe("the card's URL is hostile input", () => {
  it("reads an unknown kind as a first wink, never a made-up match", () => {
    const card = parseWinkCard(new URLSearchParams("k=married&on=Fola"));
    assert.equal(card!.copy.faces, "theirs");
    assert.equal(card!.labels.primary, "Wink back");
  });

  it("draws only https photos", () => {
    assert.equal(safePhoto("https://cdn.example/a.png"), "https://cdn.example/a.png");
    assert.equal(safePhoto("http://cdn.example/a.png"), null);
    assert.equal(safePhoto("javascript:alert(1)"), null);
    assert.equal(safePhoto("file:///etc/passwd"), null);
    assert.equal(safePhoto("not a url"), null);
  });

  it("refuses a photo aimed at a private address — the route FETCHES it", () => {
    // `https:` alone is no defence: a private host serves TLS perfectly well,
    // and the fetch is made by our server, which can reach these and the
    // open internet cannot.
    assert.equal(safePhoto("https://169.254.169.254/latest/meta-data/"), null);
    assert.equal(safePhoto("https://127.0.0.1/a.png"), null);
    assert.equal(safePhoto("https://localhost/a.png"), null);
    assert.equal(safePhoto("https://10.0.0.5/a.png"), null);
    assert.equal(safePhoto("https://172.16.4.1/a.png"), null);
    assert.equal(safePhoto("https://192.168.1.1/a.png"), null);
    assert.equal(safePhoto("https://[::1]/a.png"), null);
    assert.equal(safePhoto("https://redis.internal/a.png"), null);
    // The same loopback address written to slip past a dotted-quad check.
    assert.equal(safePhoto("https://2130706433/a.png"), null);
    assert.equal(safePhoto("https://0x7f000001/a.png"), null);
    // And the block is not over-broad: 172.32 is public, unlike 172.16-31.
    assert.equal(safePhoto("https://cdn.example/a.png"), "https://cdn.example/a.png");
    assert.equal(safePhoto("https://172.32.0.1/a.png"), "https://172.32.0.1/a.png");
  });

  it("collapses whitespace and caps names", () => {
    const card = parseWinkCard(new URLSearchParams({ k: "wink", on: `  Fola\n\n${"x".repeat(200)}` }));
    assert.equal(card!.other.name.length, 40);
    assert.ok(card!.other.name.startsWith("Fola x"));
  });

  it("makes a file name that is safe in a header", () => {
    assert.equal(winkCardFileName("Fola_Ade"), "square-wink-fola_ade.png");
    assert.equal(winkCardFileName('a"b\r\nc/../d'), "square-wink-abcd.png");
    assert.equal(winkCardFileName("😀"), "square-wink-card.png");
  });
});
