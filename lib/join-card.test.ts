import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * THE INVITATION CARD — nodes 2225:20359 and 2225:20405.
 *
 * The file draws the card at 380 x 279 and exports it at 2x. Rather than pick
 * one of those sizes, the card is a container and every measurement is a
 * percentage of its own width: 1 design unit = 0.2632cqw, 380 units = 100cqw.
 * These pin the conversion, because a value that drifts here is a card that is
 * no longer the design at ANY width, not just at one.
 */
describe("the invite card is the design at every width", () => {
  const page = readFileSync(new URL("../features/messages/components/join-page.tsx", import.meta.url), "utf8");

  /** design units -> cqw, to 3dp, the way the component writes them. */
  const cqw = (units: number) => `${((units / 380) * 100).toFixed(3).replace(/0+$/u, "").replace(/\.$/u, "")}cqw`;

  it("converts every one of the file's measurements the same way", () => {
    const fromTheFile: Array<[string, number]> = [
      ["card radius", 24],
      ["content column", 201],
      ["description column", 185],
      ["stack gap", 10],
      ["above the stack", 15],
      ["below the button", 29],
      ["button height", 33],
    ];
    for (const [what, units] of fromTheFile) {
      assert.ok(page.includes(cqw(units)), `${what}: ${units} units should appear as ${cqw(units)}`);
    }
    // And the type, which carries a readable floor under the cqw value.
    assert.match(page, /text-\[max\(13px,2\.105cqw\)\]/, "body type lost the file's 8 or its floor");
    assert.match(page, /text-\[max\(22px,5\.263cqw\)\]/, "the title lost the file's 20 or its floor");
    assert.match(page, /text-\[max\(14px,2\.364cqw\)\]/, "the button label lost the file's 8.985 or its floor");
    // The container is what every one of those percentages is measured against.
    assert.match(page, /@container/, "the cqw values have no container to resolve against");
  });

  it("keeps the banner's deliberate overflow, and the clamp that defeats it", () => {
    /*
      The file puts a 452-wide banner on a 380-wide card at x = -33: it bleeds
      past both edges and the card clips it. As percentages that is 118.9% wide
      at -8.68%.

      `max-w-none` is the load-bearing part. The CSS reset sets
      `img { max-width: 100% }`, which silently clamps the banner back to the
      card's width — the picture keeps its offset, loses its overflow, and sits
      8.68% short of the right edge with the card's purple showing through.
      Measured, not guessed: the banner covered 487 of a 535px card.
    */
    const banners = page.match(/left-\[-8\.68%\] top-0 h-full w-\[118\.9%\] max-w-none object-cover/gu) ?? [];
    assert.equal(banners.length, 2, "a banner lost its overflow, its offset, or its max-w-none");
    assert.match(page, /aspect-\[380\/108\]/, "the banner is no longer the file's ratio against the card");
  });

  it("paints the file's own ramps, at the angles its handles describe", () => {
    // Handles are normalised to the BOX, so the angle depends on the aspect —
    // computed per node rather than eyeballed off the render.
    assert.match(page, /linear-gradient\(171deg,#9F65FD_0%,#7E3BEB_100%\)/, "the card's ramp changed");
    assert.match(
      page,
      /linear-gradient\(162deg,#FFFFFF_0%,#EDEDF0_38%,#CBCBD1_63%,#F5F5F8_100%\)/,
      "the button's silver ramp changed"
    );
    // Both of the button's shadows — the purple cast and the white inner lip.
    assert.match(page, /shadow-\[0_0\.338cqw_1\.351cqw_#9F65FD,inset_0_0\.169cqw_0_rgba\(255,255,255,0\.95\)\]/);
  });

  it("still answers for everybody holding the link, not only the one state drawn", () => {
    /*
      The design shows ONE state: a house you can join. Five more are real and
      in no frame. A redesign that drops them is a prettier dead end — which is
      the failure this file exists to prevent, since none of them are visible
      on the happy path anybody would click through.
    */
    for (const state of ["member", "join", "sign-in", "expired", "used_up", "refused"]) {
      assert.ok(page.includes(`state === "${state}"`), `the ${state} state is gone`);
    }
    assert.match(page, /This link has expired/);
    assert.match(page, /This link has been used up/);
    assert.match(page, /accept\.mutate\(token/, "the join button no longer accepts the invite");
  });

  it("does not uppercase the house's name, and uses the file's bullet", () => {
    // The file's string is `THE CONVERSATION` with NO textCase — that is a
    // house whose name is uppercase, not a rule to apply to every house.
    // Asserted on the CLASS, not the word: this file's own prose explains why
    // the title is not uppercased, and a bare /uppercase/ matched that
    // explanation rather than any code — a guard that fails on its own
    // reasoning is worse than none.
    assert.doesNotMatch(
      page,
      /className="[^"]*\buppercase\b/u,
      "every lowercase house name is now being shouted"
    );
    assert.ok(page.includes("• `"), "the members separator went back to a middot");
  });

  it("keeps the default banner out of the forbidden directory", () => {
    // `public/houses` is guarded elsewhere because a design file's SAMPLE PHOTO
    // was once shipped there as a house's default picture. This is the
    // opposite — artwork the file specifies for the empty case — but the guard
    // is blunt on purpose, so the asset lives with the other room defaults.
    assert.ok(!existsSync(new URL("../public/houses", import.meta.url)), "public/houses is back");
    assert.ok(existsSync(new URL("../public/gist-rooms/invite-default-banner.svg", import.meta.url)));
    assert.match(page, /asset\("\/gist-rooms\/invite-default-banner\.svg"\)/);
  });

  it("ships the file's own vector for the coverless case, not a rebuild", () => {
    // Five stacked layers of fixed artwork — a white plate, a purple ramp, a
    // fading sunburst, the 3D mark. Rebuilt in CSS that is five chances to be
    // subtly wrong about a picture that never changes.
    const svg = readFileSync(new URL("../public/gist-rooms/invite-default-banner.svg", import.meta.url), "utf8");
    assert.match(svg, /viewBox="0 0 452 108"/, "the export is no longer the node's own box");
    assert.match(svg, /paint\d_linear_2225_20406/, "this is not the exported node any more");
  });
});
