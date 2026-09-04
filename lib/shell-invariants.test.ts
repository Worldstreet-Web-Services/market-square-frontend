import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Three shell invariants that only exist as source.
 *
 * The nav list, the rail card and the mobile bar are all client components
 * behind auth hooks and `next/image`, so nothing here can be rendered under
 * `node --test` — and the server HTML never contains any of it. What CAN be
 * proved without a browser is the shape of the source: which hrefs the nav
 * carries, that each slide owns its destination, and that the bar reserves
 * room it cannot be talked out of.
 */
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/**
 * Both files explain in prose the exact things these tests forbid — the entry
 * that was removed, the shared CTA that was split — so assertions must read
 * code, never comments. Line comments are stripped only where the `//` does
 * not follow a colon: a slide's whole point is the URL it carries, and
 * `https://` is not a comment.
 */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/**
 * A negative assertion against an empty string always passes, so a slice that
 * missed is worse than useless — it is a green test that checks nothing.
 */
const block = (source: string, open: string, close: string) => {
  const from = source.indexOf(open);
  assert.notEqual(from, -1, `"${open}" is gone — these assertions are reading the wrong code`);
  const to = source.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `"${close}" never closed "${open}" — the slice would be the rest of the file`);
  return source.slice(from, to + close.length);
};

const shell = stripComments(read("components/layout/app-shell.tsx"));
const rail = stripComments(read("components/layout/ecosystem-partners-rail.tsx"));

const NAV = block(shell, "const NAV: NavItem[] = [", "\n];");
const MOBILE_BAR = block(shell, "function MobileBar(", "\nexport function AppShell");
const CREATE_BUTTON = block(MOBILE_BAR, 'aria-label="Create post"', "</button>");
const SLIDES = block(rail, "const SLIDES: PartnerSlide[] = [", "\n];");

describe("the sidebar offers no WorldStreet entry", () => {
  it("lists nothing but routes in this app", () => {
    assert.doesNotMatch(
      NAV,
      /worldstreet/i,
      "the WorldStreet nav item is back in NAV — it was deliberately dropped, not misplaced"
    );
    // The entry was the ONLY absolute href the list ever held, so an off-site
    // URL here is that entry returning under another name. It also silently
    // breaks the active state, which no pathname can ever match.
    const hrefs = [...NAV.matchAll(/href:\s*([^,\n]+)/g)].map((match) => match[1]!.trim());
    assert.ok(hrefs.length > 5, "NAV parsed to almost no entries — the regex is reading the wrong shape");
    for (const href of hrefs) {
      assert.match(href, /^"\//, `nav href ${href} leaves the app — every entry must be a route`);
    }
  });

  it("keeps no dead constant or icon import to rebuild it from", () => {
    // A dead export is how the entry comes back by accident: the next reader
    // finds a URL constant and an external-link glyph sitting unused in the
    // shell and concludes something is missing rather than that it was cut.
    assert.doesNotMatch(shell, /WORLDSTREET_URL/, "the URL constant the entry was the only user of is back");
    assert.doesNotMatch(
      shell,
      /NEXT_PUBLIC_WORLDSTREET_URL/,
      "the shell reads the WorldStreet origin again — it has no entry left to point anywhere"
    );
    assert.doesNotMatch(
      shell,
      /\bIconExternal\b/,
      "IconExternal is imported again — nothing in the shell links off-site any more"
    );
  });
});

describe("each ecosystem slide leads to its own product", () => {
  // Split on the boundary between the two top-level entries. `headline`'s
  // nested object closes onto a key, never onto `{`, so it survives intact.
  const slides = SLIDES.split(/\},\s*\{/);

  it("points the LinkPay slide at LinkPay", () => {
    assert.equal(slides.length, 2, "the carousel is no longer the two slides these assertions describe");
    const linkpay = slides.find((slide) => /alt:\s*"LinkPay"/.test(slide));
    assert.ok(linkpay, "no slide is labelled LinkPay any more — the second card lost its identity");
    assert.match(
      linkpay,
      /href:\s*"https:\/\/linkpay-lemon\.vercel\.app\/en"/,
      "the LinkPay slide stopped pointing at LinkPay — its copy sells that product, so its CTA must open it"
    );
  });

  it("gives every slide its own destination rather than one shared CTA", () => {
    // Both cards used to share a module-level JOIN_URL, which made the second
    // slide advertise LinkPay and open the platform — a carousel where every
    // card leads to the same place is a banner with extra steps.
    const hrefs = slides.map((slide) => slide.match(/href:\s*([^,\n]+)/)?.[1]?.trim());
    for (const [at, href] of hrefs.entries()) {
      assert.ok(href, `slide ${at + 1} carries no href of its own — it is riding on someone else's`);
    }
    assert.notEqual(hrefs[0], hrefs[1], "both slides resolved to one URL again");
    assert.match(rail, /href=\{slide\.href\}/, "the Join now link stopped reading the current slide's href");
    assert.doesNotMatch(
      rail,
      /const\s+JOIN_URL/,
      "a single shared CTA URL is hardcoded again — that is what sent LinkPay's card to the platform"
    );
  });
});

describe("the mobile tab bar reserves the create button's footprint", () => {
  it("pads the frame by the button's width, and only when there is a button", () => {
    // Centred on the screen the pill grows symmetrically as the active tab's
    // label appears, and "Messages" is wide enough that its right edge reached
    // the button and touched it. Reserving makes that impossible at ANY label
    // length; a fixed nudge would fix one label and break every shorter one.
    assert.match(
      MOBILE_BAR,
      /onCompose && "pr-\[70px\]"/,
      "the bar no longer reserves the create button's footprint — the two can collide on a long tab label"
    );
    assert.match(
      MOBILE_BAR,
      /justify-center/,
      "the bar stopped centring — reserving space only recentres it if the frame still centres its content"
    );
  });

  it("pins the button out of the flow at the right edge", () => {
    assert.match(
      CREATE_BUTTON,
      /absolute right-3/,
      "the create button rejoined the flow — in the row it shifts the bar off centre by half its own width"
    );
    assert.doesNotMatch(
      CREATE_BUTTON,
      /\bfixed\b/,
      "a fixed button is positioned against the viewport, not this frame, so it drifts back over the bar"
    );
  });

  it("reserves exactly the width the button occupies", () => {
    // Two numbers in two places describing one gap: if they drift, they drift
    // silently, and the symptom is the collision this reservation prevents.
    const reserved = Number(MOBILE_BAR.match(/onCompose && "pr-\[(\d+)px\]"/)?.[1]);
    const width = Number(CREATE_BUTTON.match(/size-\[(\d+)px\]/)?.[1]);
    const inset = Number(CREATE_BUTTON.match(/right-(\d+)\b/)?.[1]) * 4;
    for (const [name, value] of [["reserved", reserved], ["width", width], ["inset", inset]] as const) {
      assert.ok(Number.isFinite(value), `could not read the button's ${name} — the classes changed shape`);
    }
    assert.equal(
      reserved,
      width + inset,
      "the reserved padding and the button's real footprint disagree — one of the two was changed alone"
    );
  });
});

/**
 * What the sidebar promotes, and what only the sidebar drops.
 *
 * `NAV` feeds three surfaces — the desktop sidebar, the mobile tab bar and the
 * mobile drawer — so "remove it from the sidebar" and "remove it" are
 * different edits with very different consequences, and the difference is not
 * visible from the list alone.
 */
describe("the sidebar hides rows without removing their route", () => {
  it("asks visibleNav WHICH surface is filtering", () => {
    // Without the surface argument the filter cannot tell the sidebar from the
    // mobile bar, and `sidebar: false` silently applies to both.
    assert.match(
      shell,
      /surface:\s*"sidebar"/,
      "the sidebar no longer identifies itself to visibleNav"
    );
    assert.match(
      shell,
      /surface:\s*"mobile"/,
      "the mobile nav no longer identifies itself to visibleNav"
    );
    assert.match(
      shell,
      /options\.surface !== "sidebar" \|\| item\.sidebar !== false/,
      "visibleNav stopped scoping `sidebar: false` to the sidebar"
    );
  });

  it("KEEPS notifications in NAV, because a phone has no other door to it", () => {
    // The desktop breadcrumb carries a bell; below md there is no breadcrumb
    // (`--ws-crumb-h` is 0) and the mobile header deliberately carries no bell
    // because this entry exists. Deleting the row — the obvious way to "finish"
    // hiding it — leaves a phone with no route to notifications and no unread
    // badge anywhere in the app.
    assert.match(
      NAV,
      /href:\s*"\/notifications"/,
      "the notifications entry was deleted from NAV, not just hidden from the sidebar"
    );
    assert.match(
      NAV,
      /"\/notifications"[\s\S]{0,400}?sidebar:\s*false/,
      "notifications is no longer hidden from the sidebar"
    );
  });

  it("hides gist rooms from the sidebar and leaves the route alone", () => {
    assert.match(
      NAV,
      /"\/gist-rooms"[^\n]*sidebar:\s*false/,
      "the gist rooms entry is back in the sidebar"
    );
  });
});

describe("the creators entry is node 225:3252", () => {
  it("says For Creators, on the file's own glyph", () => {
    assert.match(NAV, /label:\s*"For Creators"/, "the label is no longer the design's");
    assert.match(NAV, /icon:\s*IconForCreators/, "the entry is not on the design's icon");
  });

  it("still points at /studio — a renamed entry is not a moved route", () => {
    // Every link already sent to /studio has to keep working; the design
    // changed what the row says, not where it goes.
    assert.match(
      NAV,
      /href:\s*"\/studio"/,
      "the creators entry no longer points at /studio"
    );
    assert.doesNotMatch(NAV, /label:\s*"Studio"/, "the old label is back");
  });
});
