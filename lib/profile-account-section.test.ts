import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * THE ACCOUNT SECTION IS YOUR OWN PROFILE'S, AND NOBODY ELSE'S.
 *
 * The strip is Earnings / Badges / Gift Gallery / Replays, and every one of
 * those is a `/me` question: there is no route that answers what somebody else
 * was paid, what badges they hold, or what gifts they were sent. Rendered on a
 * visitor's view it would either be empty or — far worse — answer with the
 * VIEWER's own figures under the profile owner's name.
 *
 * Source-level, because the section is behind an id comparison against a
 * client hook: server-rendered HTML never contains it, so no request can prove
 * its absence. What can be proved without a browser is that the gate exists,
 * that the gallery cannot be mounted with a fabricated ownership claim, and
 * that the one query it makes is the `/me` route it says it is.
 */
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const page = stripComments(read("features/profile/components/profile-page.tsx"));
const gallery = stripComments(read("components/layout/profile-gift-gallery.tsx"));
const screen = stripComments(read("components/layout/profile-screen.tsx"));

describe("the profile's account section is own-profile only", () => {
  it("mounts the strip and gallery behind the ownership check", () => {
    assert.match(
      page,
      /\{isMe && giftGallerySlot && \(/,
      "the account strip lost its own-profile gate — it would render on strangers"
    );
  });

  it("derives ownership by COMPARING ids, never assuming", () => {
    // The backend has no isMe flag, so this is the only thing that can decide.
    assert.match(page, /profile\.data\.id === me\.data\.id/);
  });

  it("the gallery cannot be handed a fabricated ownership claim", () => {
    /*
      It used to take an `isMe` prop and the call site passed a hardcoded one,
      true only because the page already refused to mount it elsewhere. Moving
      the slot out of that gate would have left the prop still saying "yes" —
      and the component would print the VIEWER's gift counts under somebody
      else's name. The prop is gone; the gate lives only where the comparison
      is.
    */
    assert.doesNotMatch(gallery, /isMe/, "the gallery must not take an ownership prop");
    assert.doesNotMatch(screen, /ProfileGiftGallery isMe/, "no hardcoded ownership at the slot");
  });

  it("never ships a tab that HAS a panel as disabled", () => {
    /*
      THE BUG THIS EXISTS FOR. Earnings was left with a `disabledReason` after
      its panel was built, so it rendered first (it is the default), looked
      fine, and the moment you switched to Gift Gallery you could not get back
      — the button was genuinely `disabled`. It survived typecheck, lint, 974
      tests and a build, because nothing in any of those knows that a tab with
      a panel behind it must be reachable.

      The rule is the one the flagged-capability convention already implies:
      `disabled` means "there is nothing behind this", so a tab the page
      renders a panel for may never carry it.
    */
    /*
      A LITERAL reason is the bug; a COMPUTED one is the rule working. Badges
      has a panel (543:40148) and a tab whose reason is an expression that
      resolves to `undefined` the moment `GET /profiles/:username/badges`
      answers — the panel is mounted on the same data the tab keys off, so the
      two can never disagree. What this test forbids is a reason written as a
      string beside a panel that always renders, which is what Earnings had.
    */
    const panelled = [...page.matchAll(/accountTab === "(\w+)" &&/g)].map((m) => m[1]);
    assert.ok(panelled.length >= 2, "expected the earnings and gifts panels to be found");
    for (const tab of panelled) {
      const entry = page.match(new RegExp(`\\{[^{}]*value: "${tab}"[^{}]*\\}`));
      assert.ok(entry, `no tab entry found for the "${tab}" panel`);
      assert.doesNotMatch(
        entry[0],
        /disabledReason:\s*"/,
        `"${tab}" renders a panel but its tab is disabled — it cannot be reached`
      );
    }
  });

  it("reads the caller's OWN tips and nothing else", () => {
    const api = stripComments(read("features/tips/lib/api.ts"));
    assert.match(api, /"\/me\/tips\/received"/, "the counts must come from the /me route");
    // There is no route for another person's tips; a path built from a
    // username here would be a phantom that 404s.
    assert.doesNotMatch(api, /tips\/received\/\$\{/);
  });

  it("counts only CONFIRMED tips", () => {
    /*
      The service's own words on `pending`: it "must never be presented to a
      user as though the money arrived". A gift counted before it settles is
      exactly that, and a tip that later fails would have to be counted back
      down.
    */
    assert.match(
      gallery,
      /tip\.status !== "confirmed"/,
      "pending or failed tips must not be counted as gifts received"
    );
  });

  it("shows a zero for what you OWN and no number for what you were SENT", () => {
    /*
      The asymmetry is the whole rule, and it was one-sided before there was
      anything to own.

      "YOU OWN NONE" IS A FACT WITH AN ACTION ATTACHED — the `+` beside it is
      how you fix it, and node 1285:79134 draws that 0 explicitly on two
      tiles. Hiding it would remove the reason the control is there.

      "NOBODY HAS SENT YOU ONE" is closer to unknown, and a confident 0 states
      something about other people we would rather not claim — the same rule
      the balance chip and the house member line follow.

      So the count renders whenever it is a number, and WHICH number it is
      decides whether a zero can occur: owned falls back to 0, received falls
      back to null.
    */
    assert.match(gallery, /count !== null &&/, "an uncounted gift must render no number");
    assert.match(
      gallery,
      /economy === true \? \(owned\.get\(gift\.id\) \?\? 0\) : \(counts\.get\(gift\.id\) \?\? null\)/,
      "owned and received no longer differ on whether a zero is drawn"
    );
  });
});
