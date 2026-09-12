import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { readFontMetrics } from "./font-metrics.ts";
import { friendsMomentCopy, type FriendsMomentKind } from "./friends-popup.ts";
import { layoutText } from "./kerned-text.ts";

const font = (file: string) => readFontMetrics(readFileSync(new URL(`../assets/fonts/${file}`, import.meta.url)));
const bold = font("Geist-Bold.ttf");
const medium = font("Geist-Medium.ttf");

/*
  Every expected number below was MEASURED in Chrome 152 with these exact font
  files (getBoundingClientRect on a white-space:pre span; line breaks read off
  character rects in a 238px, 14.71px bold, centred paragraph — the popup's
  own box). Chrome snaps widths to 1/64 px, hence the tolerance.
*/
const CHROME = 1 / 64 + 0.001;

describe("the font's own metrics", () => {
  it("reads units per em and a space's advance", () => {
    assert.equal(bold.unitsPerEm, 1000);
    assert.equal(bold.advanceOf(bold.glyphOf(32)), 228);
    assert.equal(medium.advanceOf(medium.glyphOf(32)), 243);
  });

  it("finds the kern pairs a browser applies", () => {
    // The amount is Chrome's: "AV" measures 19.8125px at 14.71px against the
    // two raw advances, so the pair must close the gap by exactly the rest.
    const raw = (bold.advanceOf(bold.glyphOf(0x41)) + bold.advanceOf(bold.glyphOf(0x56))) * (14.71 / 1000);
    const kern = bold.kerningOf(bold.glyphOf(0x41), bold.glyphOf(0x56)) * (14.71 / 1000);
    assert.ok(kern < 0, "A→V is kerned");
    assert.ok(Math.abs(raw + kern - 19.8125) <= CHROME);
  });

  it("maps a character the font lacks to .notdef", () => {
    assert.equal(bold.glyphOf(0x1f600), 0);
  });
});

describe("kerned widths match Chrome", () => {
  const cases: [typeof bold, number, string, number][] = [
    [bold, 14.71, "You and Fola Ade are now friends now!", 273.984375],
    [bold, 14.71, "Start gisting or later", 146.390625],
    [bold, 14.71, "AVAWAY Tokyo", 104.984375],
    [bold, 14.71, "Chukwuemeka", 105.703125],
    [bold, 14.71, "Oluwaseun Adebayo-Johnson", 214.53125],
    [bold, 14.71, "winked at each other!", 154.453125],
    [bold, 14.71, "Wink back or later", 132.46875],
    [bold, 14.71, "Follow back or later", 142.921875],
    [bold, 14.71, "Yo", 17.34375],
    [bold, 14.71, "AV", 19.8125],
    [bold, 14.71, "To", 16.734375],
    [medium, 11.77, "Start gisting", 68.140625],
    [medium, 11.77, "Wink at Fola Ade", 92.9375],
    [medium, 11.77, "Follow back", 66.625],
    [medium, 11.77, "Wink back", 58.53125],
    [medium, 11.77, "Wink at Chukwuemeka Okonkwo", 181],
  ];
  for (const [metrics, size, text, chrome] of cases) {
    it(`"${text}" at ${size}px`, () => {
      const [line] = layoutText([{ text, dim: false }], metrics, size);
      assert.ok(Math.abs(line!.width - chrome) <= CHROME, `${line!.width} vs Chrome ${chrome}`);
    });
  }
});

describe("the card's headline wraps where the popup wraps it", () => {
  const headline = (kind: FriendsMomentKind, name: string) => {
    const copy = friendsMomentCopy(
      { kind, actor: { id: "x", username: "x", displayName: name, avatarUrl: null }, notificationIds: [] },
      name
    );
    return layoutText(copy.headline, bold, 14.71, 238).map((line) => line.pieces.map((p) => p.text).join(""));
  };

  const cases: [FriendsMomentKind, string, string[]][] = [
    ["friends", "Fola Ade", ["You and Fola Ade are now friends", "now!"]],
    ["friends", "Tunde", ["You and Tunde are now friends", "now!"]],
    ["friends", "Chukwuemeka Okonkwo", ["You and Chukwuemeka Okonkwo", "are now friends now!"]],
    ["friends", "Oluwaseun Adebayo-Johnson", ["You and Oluwaseun Adebayo-", "Johnson are now friends now!"]],
    ["friends", "ogazboiz", ["You and ogazboiz are now", "friends now!"]],
    ["friends", "Mariam Abdulrahman", ["You and Mariam Abdulrahman", "are now friends now!"]],
    ["friends", "Ifeoluwa Oyelaran", ["You and Ifeoluwa Oyelaran are", "now friends now!"]],
    ["mutual-wink", "Fola Ade", ["You and Fola Ade winked at each", "other!"]],
    ["mutual-wink", "Chukwuemeka Okonkwo", ["You and Chukwuemeka Okonkwo", "winked at each other!"]],
    ["mutual-wink", "Abdulrahman Bello", ["You and Abdulrahman Bello", "winked at each other!"]],
    ["wink", "Fola Ade", ["Fola Ade winked at you!"]],
    ["wink", "Oluwaseun Adebayo-Johnson", ["Oluwaseun Adebayo-Johnson", "winked at you!"]],
    ["wink", "Chukwuemeka Okonkwo Adeyemi", ["Chukwuemeka Okonkwo", "Adeyemi winked at you!"]],
  ];
  for (const [kind, name, lines] of cases) {
    it(`${kind}: ${name}`, () => assert.deepEqual(headline(kind, name), lines));
  }
});

describe("pieces carry the kerning and the colours", () => {
  const [line] = layoutText(
    [
      { text: "You ", dim: false },
      { text: "and", dim: true },
    ],
    bold,
    14.71
  );

  it("keeps every character, in order", () => {
    assert.equal(line!.pieces.map((p) => p.text).join(""), "You and");
  });

  it("splits where the colour changes", () => {
    assert.ok(line!.pieces.some((p) => p.dim && p.text.startsWith("a")));
    assert.ok(line!.pieces.every((p) => !p.dim || !/[You]/.test(p.text)));
  });

  it("puts a kern pair's adjustment on the piece after it", () => {
    // "Yo" is kerned, so "o" starts a piece pulled left.
    const o = line!.pieces.find((p) => p.text.startsWith("o"));
    assert.ok(o && o.kern < 0);
  });

  it("adds up: raw advances plus kerns are the kerned width", () => {
    const raw = (text: string) =>
      [...text].reduce((sum, ch) => sum + bold.advanceOf(bold.glyphOf(ch.codePointAt(0)!)), 0) * (14.71 / 1000);
    const total = line!.pieces.reduce((sum, p) => sum + raw(p.text) + p.kern, 0);
    assert.ok(Math.abs(total - line!.width) < 1e-9);
  });

  it("collapses runs of whitespace like white-space: normal", () => {
    const [spaced] = layoutText([{ text: "  Fola \n  Ade  ", dim: false }], bold, 14.71);
    assert.equal(spaced!.pieces.map((p) => p.text).join(""), "Fola Ade");
  });
});
