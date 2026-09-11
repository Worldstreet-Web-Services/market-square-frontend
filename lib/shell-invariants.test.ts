import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("puts gist rooms IN the sidebar, spelled the design's way", () => {
    // It was `sidebar: false` against the older file, on the argument that the
    // hallway at the top of Home was door enough. Node 496:13107 draws the row
    // third, between Explore and Chat — a summary needs somewhere to point, and
    // the hallway only ever showed the rooms open right now.
    assert.match(NAV, /label:\s*"Gistrooms"/, "the row lost the file's spelling");
    assert.doesNotMatch(
      NAV,
      /"\/gist-rooms"[^\n]*sidebar:\s*false/,
      "gist rooms is hidden from the sidebar again"
    );
    // A renamed row is not a moved route.
    assert.match(NAV, /href:\s*"\/gist-rooms"/, "the gist rooms route moved");
  });

  it("draws the rows on the FILE'S glyphs, not the app's nearest equivalents", () => {
    /*
      Three of these were not near-misses. Explore was a MAGNIFIER where
      496:13119 draws a GLOBE; Gistrooms was a house where 496:13126 draws a
      MICROPHONE; Live was our own play badge where 496:13139 draws a framed
      Video. A magnifier says "search" and a globe says "everything out there",
      and only one of those is what Explore became.

      Pinned by the icon a row is wired to, and by the glyph module being the
      exported one — `sidebar-icons.tsx` holds the file's vectors verbatim with
      the baked fills swapped for currentColor.
    */
    /*
      Matched WITHIN the row's own object literal, not on one line.

      These were `/"\/gist-rooms"[^\n]*icon:/` — `[^\n]*` forbids a newline, so
      the assertion held only while the whole entry fitted on one line. A
      formatter wrapping a single entry broke a suite about ICONS, which is the
      same brittleness as asserting `className="fixed ` by its position in a
      string. The invariant is "this row is wired to this glyph"; where the
      line breaks is not part of it.
    */
    const rowFor = (href: string) => {
      const at = NAV.indexOf(`href: "${href}"`);
      assert.notEqual(at, -1, `no NAV row for ${href}`);
      const end = NAV.indexOf("}", at);
      return NAV.slice(at, end === -1 ? undefined : end);
    };
    const wiredTo: Array<[string, string, string]> = [
      ["/", "IconSbHome", "Home is off the file's glyph"],
      ["/discover", "IconSbExplore", "Explore is not the file's globe"],
      ["/gist-rooms", "IconSbGistrooms", "Gistrooms is not the file's microphone"],
      ["/messages", "IconSbChat", "Chat is off the file's glyph"],
      ["/live", "IconSbLive", "Live is not the file's video"],
      ["/arkmarks", "IconSbLibrary", "Library is off the file's bookmark"],
    ];
    for (const [href, icon, why] of wiredTo) {
      assert.match(rowFor(href), new RegExp(`icon:\\s*${icon}\\b`), why);
    }
  });

  it("carries LIBRARY on the saved-posts route, not a new one", () => {
    // 496:13107 draws it sixth, on a bookmark. The design renamed the
    // DESTINATION; the act of saving is still the Arkmark and the route is
    // still /arkmarks — the same relationship "For Creators" has with /studio.
    assert.match(NAV, /label:\s*"Library"/, "the library row is gone");
    assert.match(NAV, /href:\s*"\/arkmarks"/, "library no longer points at /arkmarks");
  });
});

describe("the creators entry is node 225:3252", () => {
  it("says For Creators, on the file's own glyph", () => {
    assert.match(NAV, /label:\s*"For Creators"/, "the label is no longer the design's");
    // The glyph is the same MusicNotesPlus it always was — it now comes from
    // `sidebar-icons.tsx`, exported from 496:13153 with the rest of the rail's
    // set, rather than from the app's own copy of it.
    assert.match(NAV, /icon:\s*IconSbCreators/, "the entry is not on the design's icon");
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

/**
 * Two things that were CLIPPED or INERT, and could be again.
 *
 * Both failed silently. The partner card looked finished while its call to
 * action was cut in half, and the deck's follow badge looked like a control
 * while doing nothing at all — neither produces an error, a warning or a
 * failing test on its own.
 */
describe("the partner card cannot hide its own call to action", () => {
  it("uses a MINIMUM height, never a fixed one", () => {
    // `h-[156px]` is the height the file draws, and it holds only while the
    // headline is two lines. "One Platform. Every Currency. Every Asset."
    // wraps to three at the rail's real width.
    assert.doesNotMatch(
      rail,
      // Negative lookbehind, or this matches the `h-[156px]` inside
      // `min-h-[156px]` and fails on the fix itself.
      /(?<!min-)h-\[156px\]/,
      "the partner card is back on a fixed height — a longer headline will push Join now out of it"
    );
    assert.match(rail, /min-h-\[156px\]/, "the card lost its minimum height");
  });

  it("does not clip its overflow", () => {
    // With a floor and flowing children nothing should overflow; if something
    // does, it must be visible rather than quietly cut off.
    assert.doesNotMatch(
      rail,
      /overflow-hidden/,
      "overflow-hidden is back on the partner card — that is what made the clipped Join now invisible"
    );
  });

  it("lets the headline column shrink instead of pinning its width", () => {
    // Without min-w-0 a flex child refuses to go below its longest word, and
    // the text pushes into the logo again.
    assert.match(rail, /min-w-0/, "the headline column can no longer rewrap");
  });
});

describe("the friends deck offers a real Follow", () => {
  /*
    The CARD is `PalCard`, shared by the deck (Home and `/pals`) and the
    "Suggested Pals" rail (540:19351) — one object drawn at two sizes, because
    two copies of this markup is how a wink cooldown gets fixed on one surface
    and not the other. So the badge and the two controls are asserted here; the
    FAN — placement, tilt, scale, opacity — is asserted on the deck below.
  */
  const card = stripComments(read("components/layout/pal-card.tsx"));

  it("is a button, not a decorative glyph", () => {
    // It shipped as a bare <IconDeckAdd/>: pass and wink were real buttons and
    // the one control people actually reach for was an ornament.
    assert.match(
      card,
      /aria-label=\{isFollowing \? `Unfollow/,
      "the follow badge is not a labelled control any more"
    );
    assert.match(card, /follow\.mutate\(!isFollowing\)/, "the follow badge does nothing again");
  });

  it("sits INSIDE the card, as both files place it", () => {
    // The badge hung 8px off the right edge once, which is what made it read
    // as stuck onto the photo rather than part of the card. Node 844:23446 puts
    // it 23.27 in from the right and 20.59 from the top; the rail's 6.77.
    assert.doesNotMatch(card, /-right-2/, "the follow badge hangs outside the card again");
    assert.match(card, /right: node\.badge\.right/, "the deck badge lost the file's inset");
    assert.match(card, /right: 23\.27, top: 20\.59/, "the deck's own 23.27 / 20.59 inset is gone");
    assert.match(card, /right: g\.badge\.inset/, "the rail badge lost the file's inset");
    assert.match(card, /inset: 6\.77/, "the rail's own 6.77 inset is gone");
  });

  it("paints ABOVE the photo it overlaps", () => {
    // The badge is `absolute` and sits before the photo's own `relative`
    // wrapper in the markup. Two positioned elements at the same z-index paint
    // in DOM order, so without an explicit lift the photo covers the badge and
    // the control vanishes into the picture — not clipped, not mispositioned,
    // just underneath. Nothing else in the build can see that.
    assert.match(
      block(card, "aria-label={isFollowing ?", "</button>"),
      /\bz-10\b/,
      "the follow badge lost its z-index and is painted under the photo again"
    );
  });

  it("reads the follow edge rather than the raw field", () => {
    assert.match(card, /useIsFollowing\(profile\)/, "a missing isFollowing can now fabricate Following");
  });
});

describe("the friends deck is node 844:18440's, on Home and on /pals", () => {
  const deck = stripComments(read("components/layout/friends-deck.tsx"));
  const layout = stripComments(read("lib/deck-layout.ts"));
  const card = stripComments(read("components/layout/pal-card.tsx"));

  it("DIMS the two cards behind by the node's own opacity — 0.39 and 0.30", () => {
    // The file draws depth here with layer opacity on the whole back card,
    // photo and controls included; the front card alone is at full strength.
    assert.match(layout, /opacity: 0\.39/, "the left card lost the node's 0.39");
    assert.match(layout, /opacity: 0\.3\b/, "the right card lost the node's 0.30");
    assert.match(deck, /opacity: swipe\.committing \? 0 : place\.opacity/, "the node's opacity is no longer applied");
  });

  it("TILTS and SHRINKS them by the node's solved sizes, never its bounding boxes", () => {
    assert.match(layout, /rot: -6\.836/, "the left card lost its tilt");
    assert.match(layout, /rot: 13\.524/, "the right card lost its tilt");
    assert.match(layout, /scale: 0\.8171/, "the left card is no longer 444.01 wide");
    assert.match(layout, /scale: 0\.83\b/, "the right card is no longer 451.06 wide");
    assert.match(deck, /rotate\(\$\{place\.rot\}deg\) scale\(\$\{place\.scale \* k\}\)/, "tilt or scale is no longer applied");
  });

  it("scales the whole fan by ONE factor from lib/deck-layout, never inline", () => {
    assert.match(deck, /deckLayout\(\{ room/, "the deck computes its own scale again");
    assert.doesNotMatch(deck, /(left|right)-0 bg-(black|white)/, "a step disc is pinned to the column edge instead of the file's own position");
    assert.doesNotMatch(deck, /\/ 917|\/ 543/, "a file span is divided inline in the deck");
  });

  it("BROWSES on Home and DECIDES on /pals — never the other way round", () => {
    /*
      This used to read "SWIPES TO BROWSE and never to act", full stop, and it
      was right for the surface it was written against. `/pals` changed the
      rule rather than broke it: on a page whose whole job is one person at a
      time, right FOLLOWS and left SKIPS, and the file's verdict stamps
      (856:23668 / 856:23693) announce which before the finger lifts.

      What has NOT changed, and is the half worth keeping: on HOME the deck is
      one block inside a timeline, and a gesture that quietly followed somebody
      while a reader scrolled past would be an act nobody asked for. So the
      browse branch is still asserted, and it is still the default.
    */
    assert.match(deck, /decide=\{heading === "pals"\}/, "every deck now shares one gesture — Home can act again, or /pals cannot");
    assert.match(
      deck,
      /if \(!decide\) \{\s*onStep\(decision === "follow" \? -1 : 1\);/,
      "Home's swipe no longer maps to steps"
    );
    assert.match(deck, /canCommit:/, "a swipe past either end flies out instead of springing back");
  });

  it("a swipe can follow but can never UNfollow, and never without the gate", () => {
    /*
      `mutate(!isFollowing)` would have made a right swipe on somebody you
      already follow toggle them OFF — the one gesture on the page that could
      undo an act the reader never asked to undo. And a follow is a real act,
      so a signed-out reader meets the sign-in invitation rather than a
      silent no-op.
    */
    assert.match(deck, /decision === "follow" && !isFollowing/, "a right swipe can now unfollow somebody");
    assert.match(deck, /gate\(\(\) => follow\.mutate\(true\)\)/, "the swipe follows without the sign-in gate, or with a toggle");
    assert.doesNotMatch(deck, /follow\.mutate\(!/, "the follow is a toggle again");
  });

  it("stamps the verdict only on the front card, and only where it decides", () => {
    // A stamp on a card being paged past would promise an act that is not
    // happening; on a card behind the front one it would label the wrong person.
    assert.match(
      deck,
      /\{decide && front && \(\s*<SwipeVerdict/,
      "the verdict stamp is drawn where the gesture does not decide, or on a back card"
    );
    const stamp = stripComments(read("components/layout/swipe-verdict.tsx"));
    // The red pill's stroke is a real weight at ZERO ALPHA — it paints nothing.
    assert.doesNotMatch(stamp, /border(?!-radius)|outline:/, "the red stamp grew a border the file does not draw");
    assert.match(stamp, /opacity: verdict/, "the stamp no longer brightens with the drag");
    assert.match(stamp, /pals\/green-flag\.svg|pals\/red-flag\.svg/, "the file's own glyphs were swapped for a repo icon");
  });

  it("shows the step discs and the page pills on a PHONE too", () => {
    /*
      Both were desktop-only and ogazboiz asked why. The discs were `wide`-
      gated on "on a phone the fan is browsed by hand", which was true while
      the gesture was navigation and wrong the moment /pals made it a decision:
      a swipe there only goes forward, so without the discs a mis-swipe on a
      phone cannot be taken back at all. The pills were dropped outright in the
      deck rewrite.

      Cost is why this is not a trade: `deckExtent` grows from 943 file units
      to 954 when the discs are counted, because the fan is already wider than
      the right disc. 1.2% of card width buys the only way back.
    */
    assert.doesNotMatch(deck, /\{wide && \(/, "the step discs are gated behind a breakpoint again");
    assert.match(deck, /arrows: true/, "the layout stopped reserving room for the discs, so they overhang the column");
    assert.match(deck, /<DeckDots count=\{3\}/, "the page pills are gone again — a fan cannot say there is more after this one");
    assert.doesNotMatch(
      deck,
      /DeckDots[\s\S]{0,160}(hidden md:|md:hidden)/,
      "the page pills are hidden on one size again"
    );
  });

  it("keeps the rail on its own drawing — the node geometry is a second KIND, not a fork", () => {
    assert.match(card, /kind: "node-844"/, "the node geometry lost its discriminator");
    assert.match(card, /export const RAIL_CARD: PalCardGeometry/, "the rail's RAIL_CARD changed shape");
    assert.match(card, /export const DECK_CARD: PalCardNodeGeometry/, "the deck's geometry is gone");
    assert.match(deck, /geometry=\{card\}/, "the deck is not drawing the node's card");
    assert.match(deck, /const card: PalCardNodeGeometry = /, "the deck's card is no longer a node-844 geometry");
  });

  it("is the ONE deck: /pals renders it rather than a second fan", () => {
    const pals = stripComments(read("components/layout/pals-screen.tsx"));
    assert.match(pals, /<FriendsDeck heading="pals" \/>/, "/pals grew its own deck again");
    assert.ok(!existsSync(resolve("components/layout/make-some-friends.tsx")), "the older deck is back");
  });
});

/**
 * A room with no cover shows NO COVER.
 *
 * The design fills a 741x200 rectangle white because it is drawing a room that
 * HAS a picture. An empty tinted slab in its place is our stand-in for
 * something that does not exist, and it reads as an image that failed to load
 * rather than as a room that never had one — while pushing everything below it
 * 216px down the page to make room for nothing.
 */
describe("the gist room hides its cover rather than faking one", () => {
  const room = stripComments(read("features/houses/components/house-room.tsx"));

  it("renders the cover only when there is one", () => {
    assert.match(
      room,
      /\{stream\.thumbnailUrl && \(/,
      "the cover is no longer conditional on there being a cover"
    );
  });

  it("keeps no empty panel to stand in for it", () => {
    // The placeholder was `<div className="h-[200px] w-full rounded-3xl
    // bg-white/[0.06]" />`. Nothing should hold that space open.
    assert.doesNotMatch(
      room,
      /h-\[200px\][^"]*bg-white/,
      "the empty cover placeholder is back"
    );
  });
});

/**
 * A MENU OPENED IN A FEED ITEM MUST PAINT OVER THE ITEM BELOW IT.
 *
 * `ws-enter` animates a transform and holds it with `both`, so every feed item
 * carries one permanently — and a transform creates a stacking context. The
 * post's overflow menu is `z-20`, but that only orders it INSIDE its own post;
 * against the next post, a sibling stacking context, DOM order wins. The menu
 * opened in exactly the right place and the following post painted over it,
 * with the next author's Follow button sitting on top of "Scam or fraud".
 *
 * `Sheet` hit the same transform and was portalled, but that was a different
 * failure: a `position: fixed` overlay anchors to the transformed ancestor
 * rather than the viewport, which no z-index can repair. An absolute dropdown
 * is positioned correctly here — only its paint order is wrong.
 */
describe("a feed item that owns an open popover", () => {
  const css = read("app/globals.css");

  it("lifts above the items after it", () => {
    assert.match(
      css,
      /\.ws-enter:has\(\.ws-popover\)\s*\{[^}]*z-index:\s*\d+/,
      "a popover in a feed card can be painted over by the next card again"
    );
  });

  it("is POSITIONED, or the z-index does nothing", () => {
    // `ws-enter` is `position: static`, and z-index has no effect on a static
    // element outside a flex or grid parent — the feed is a plain block list.
    assert.match(
      css,
      /\.ws-enter:has\(\.ws-popover\)\s*\{[^}]*position:\s*relative/,
      "the lift lost its positioning and is inert"
    );
  });

  it("stays STRICTLY under the breadcrumb bar", () => {
    /*
      Read the breadcrumb's own z-index rather than hard-coding one, because
      this is a RELATIONSHIP and the number on either side may move.

      The first attempt set the lift to 30, which is exactly what the breadcrumb
      carries. Equal z-index is broken by DOM order and the feed comes later, so
      the post won: its author row, avatar and Follow button printed over
      "Ark Ecosystem / Market Square" and the search field.
    */
    const shell = read("components/layout/app-shell.tsx");
    const crumb = shell.match(/sticky top-0 z-(\d+)[^"]*h-\[76px\]|h-\[76px\][^"]*sticky top-0 z-(\d+)/);
    const crumbZ = Number(crumb?.[1] ?? crumb?.[2] ?? 0);
    assert.ok(crumbZ > 0, "could not find the breadcrumb bar's z-index in the shell");

    const lift = css.match(/\.ws-enter:has\(\.ws-popover\)\s*\{[^}]*\}/)?.[0] ?? "";
    const z = Number(lift.match(/z-index:\s*(\d+)/)?.[1] ?? 0);

    assert.ok(z > 0, "the lift must beat its sibling feed items");
    assert.ok(
      z < crumbZ,
      `the lift is z-${z} and the breadcrumb is z-${crumbZ}; a tie or a win means a post paints over the chrome`
    );
  });
});

/**
 * THE WELCOME SEQUENCE HAS TO FIT THE PHONE IT IS ON.
 *
 * Measured on a real device by ogazboiz and then reproduced here: on any
 * viewport shorter than ~750 — which is every ordinary phone once the browser's
 * own chrome is showing — the Skip button sat below the fold. 143px over at
 * 375x553, 85 at 390x664, 69 at 360x620, on all three carousel screens.
 *
 * The arithmetic lives in `lib/welcome-fit.ts` and is checked numerically in
 * its own tests. What is asserted here is the WIRING that lets it work at all,
 * because each piece is one careless edit from silently undoing the fix and
 * none of them looks load-bearing:
 */
describe("the welcome sequence fits a short phone", () => {
  const frame = stripComments(read("components/layout/welcome/welcome-art.tsx"));
  const flow = stripComments(read("components/layout/welcome/welcome-flow.tsx"));
  const css = read("app/globals.css");

  it("gives the reflowed frame a DEFINITE height", () => {
    /*
      `min-h-dvh` says "at least the viewport" and then lets the content push
      past it — which is exactly what it was doing. Flexbox can only take space
      away from a child when the container's height is definite, so this single
      word is what makes every other part of the fix function.
    */
    assert.match(
      frame,
      /@container relative flex h-dvh w-full flex-col/,
      "the reflowed frame is back on min-h-dvh, so nothing can shrink and Skip falls off the bottom again"
    );
  });

  it("lets the column shrink inside it", () => {
    /*
      A flex item defaults to `min-height: auto`, i.e. "never smaller than my
      content". Without `min-h-0` the column reports the room it WANTS rather
      than the room it has, the fit pass measures that inflated figure, and the
      band is sized against space that does not exist.
    */
    assert.match(
      flow,
      /ws-welcome-bottom[^"]*\bmin-h-0\b/,
      "the welcome column can grow past the frame again — the fit pass will measure room it does not have"
    );
  });

  it("measures the column rather than the artwork", () => {
    /*
      The distinction that keeps screen two intact: the file runs the fan of
      pals 188% of the stage wide ON PURPOSE. Fitting the PICTURE to the
      viewport turned that deliberate bleed into a row of thumbnails once
      before. The fit pass measures what the TEXT needs and gives the picture
      what is left.
    */
    assert.match(frame, /querySelector<HTMLElement>\("\.ws-welcome-bottom"\)/);
    assert.match(
      frame,
      /--ws-band-cap/,
      "the band is no longer capped by the room left, so a short phone overflows again"
    );
  });

  it("publishes the fit on :root, where the derived vars are computed", () => {
    /*
      A custom property resolves where it is USED. `--ws-stage-w`,
      `--ws-art-band-h` and `--ws-art-band-top` are all derived on `:root` in
      globals.css, so a value set on the frame — a descendant — would be
      invisible to that computation and every one of them would fall back.
    */
    assert.match(
      frame,
      /document\.documentElement\.style/,
      "the fit is being published somewhere the :root derivations cannot see it"
    );
  });

  it("re-fits after every render, not only on resize", () => {
    // Continuing to the finale swaps the whole branch away without changing
    // the frame's size, so no ResizeObserver entry is delivered.
    assert.match(
      frame,
      /useLayoutEffect\(\(\) => \{\s*if \(root\.current\) fitReflowedColumn\(root\.current\);\s*\}\);/,
      "a step change no longer re-fits — the finale inherits the previous screen's band"
    );
  });

  it("scales only GAPS, never type or tap targets", () => {
    /*
      `--ws-air` multiplies padding and margins. If it ever reaches a
      font-size, a button height or the lockup, the screen stops overflowing by
      becoming unreadable instead — which is not a fix.
    */
    const air = css.match(/\.ws-welcome-bottom \{[^}]*\}/g)?.join("\n") ?? "";
    assert.match(air, /padding-top: calc\(40px \* var\(--ws-air, 1\)\)/);
    for (const banned of ["font-size", "height:", "line-height"]) {
      assert.ok(
        !new RegExp(`${banned}[^;]*--ws-air`).test(css),
        `--ws-air reached ${banned}; it may only scale gaps`
      );
    }
  });

  it("leaves the phone the design was tuned for untouched", () => {
    // welcomeAir(844) === 1 is pinned in lib/welcome-fit.test.ts; this is the
    // other half of it — the stylesheet must still ask for the file's 130vw
    // whenever the cap is not the smaller number.
    assert.match(
      css,
      /--ws-stage-w:\s*max\(\s*60vw,\s*min\(calc\(100dvh \* 1440 \/ 1024\), 130vw, var\(--ws-band-cap, 200vw\)\)\s*\)/,
      "the stage no longer prefers the file's 130vw when there is room for it"
    );
  });
});

/**
 * THE GROUP PICKER STATES THE SIZE RULE IN ONE PLACE — THE SERVICE.
 *
 * `GROUP_MAX = 20` used to block the twenty-first selection and print "(max)"
 * on Continue. It is gone: the size of a group is the service's rule, and
 * stating it in two places is how the two disagree — which they already had,
 * the service refusing with "at most 20 other people" on create and "at most
 * 21 people" on add, two numbers for one rule.
 *
 * Removing it moves the refusal from tap-time to submit-time, which is only
 * safe because the refusal is now rendered. Both halves are asserted together
 * because shipping the first without the second is a silent failure after
 * somebody has picked members and named the group.
 */
describe("the group picker leaves the size rule to the service", () => {
  const flow = stripComments(read("components/layout/create-group-flow.tsx"));

  it("hardcodes no member cap", () => {
    assert.ok(
      !/GROUP_MAX/.test(flow),
      "a client-side group cap is back — it will disagree with the service the first time either number moves"
    );
    assert.ok(
      !/\(max\)/.test(flow),
      "the Continue button claims a maximum again, with nothing to read it off"
    );
  });

  it("never refuses a selection locally", () => {
    // Every tap toggles. A `>=` inside `toggle` is the cap wearing a different
    // name, so the shape is asserted rather than the constant.
    const toggle = flow.match(/const toggle = \(profile: Profile\) =>[\s\S]*?\n {4}\);/)?.[0] ?? "";
    assert.ok(toggle, "could not find the toggle handler");
    // Arrows first: `=>` is full of the very character a comparison uses, and
    // matching it made this fail on the correct code.
    const body = toggle.replace(/=>/g, "");
    assert.ok(
      !/[<>]=?|\.length\s*[!=]==?/.test(body),
      "the picker refuses a selection again — the service is meant to be the only authority on group size"
    );
  });

  it("shows the service's refusal instead of failing silently", () => {
    /*
      The mutation carried ONLY `onSuccess` before this. A 400 set the error
      and nothing rendered it — the spinner stopped and the sheet sat there.
      With no client cap that is now the path people actually reach.
    */
    assert.match(
      flow,
      /createGroup\.isError/,
      "the create sheet no longer renders a failed create — a refused group fails silently"
    );
    assert.match(
      flow,
      /errorMessage\(createGroup\.error,/,
      "the refusal is not going through errorMessage, so a raw code or a developer string can reach the screen"
    );
    assert.match(
      flow,
      /role="alert"[\s\S]{0,120}errorMessage\(createGroup\.error/,
      "the refusal is not announced — a screen reader gets nothing when the create fails"
    );
  });
});

/**
 * THE TOP BAR IS NODE 647:17439 — the live file, updated 2026-09-10 21:10.
 *
 * It replaced the "Ark Ecosystem / <page>" breadcrumb with the lockup and the
 * account cluster. An earlier build added a search field from a cached copy
 * of this node dated 2026-09-08; the live node has NO search, which matches
 * ogazboiz's two earlier requests to keep search out of the chrome, so its
 * absence is pinned. So are the parts the file adds: the purple count badge on
 * the bell, the avatar and caret inside one 7%-white pill, and a bottom
 * hairline that runs the whole window while the bar itself stays capped
 * ("the border line should full the screen for point A to point B").
 */
describe("the top bar is node 647:17439", () => {
  const shell = stripComments(read("components/layout/app-shell.tsx"));
  const bar = shell.slice(shell.indexOf("function TopBar("), shell.indexOf("function TopBarActions"));
  const actions = shell.slice(shell.indexOf("function TopBarActions"), shell.indexOf("export function MobileBar"));

  it("no longer carries the breadcrumb", () => {
    assert.doesNotMatch(shell, /Ark Ecosystem/, "the breadcrumb root is back in the chrome");
    assert.doesNotMatch(shell, /function Breadcrumb\b/);
  });

  it("carries no search field, as the live node has none", () => {
    assert.doesNotMatch(bar, /role="search"|placeholder=/, "a search field is back in the top bar");
    assert.doesNotMatch(shell, /function TopBarSearch\b/);
  });

  it("draws the bottom hairline across the whole window, not just the capped frame", () => {
    assert.match(bar, /after:w-\[200vw\]/, "the hairline stops at the frame's edges again");
    assert.match(
      shell,
      /min-h-dvh w-full overflow-x-clip bg-chrome/,
      "the wrapper stopped clipping the wide hairline, which would add a horizontal scrollbar"
    );
  });

  it("puts the unread COUNT on the bell in the file's purple badge", () => {
    assert.match(actions, /<IconTopBell /);
    assert.match(actions, /bg-\[#9F5AFF\]/, "the badge lost the file's #9F5AFF");
    assert.match(actions, /notifications > 9 \? "9\+" : notifications/, "the badge no longer shows the count");
  });

  it("opens the account menu from one pill holding the avatar and caret", () => {
    assert.match(shell, /<RailMenu\s+label="Account"\s+align="below"/);
    assert.match(actions, /gap-\[23px\] rounded-\[36px\] bg-white\/\[0\.07\]/, "the avatar pill lost the file's geometry");
    assert.match(actions, /<IconTopCaret /);
    assert.match(shell, /function AccountMenuItems/);
  });

  it("shows the lockup only while the rail is off, so there is never a second logo", () => {
    assert.match(shell, /<TopBar showBrand=\{!railOn\} wide=\{wide\} \/>/);
  });

  it("lines its edges up with the content under it", () => {
    /*
      "it look as if the header is wider than the content". The design insets
      the lockup 54 and the cluster 44 from a 1438 frame, which on the app's
      capped, centred layout left both hanging past the column and the rail.
      The bar's content now takes the SAME width as that group — the 600
      column, plus the rail's width from lg — with the rail's own right padding,
      so the logo starts on the column's edge and the cluster ends on the rail
      cards' edge. Read from the rail rather than restated, so the two cannot
      drift.
    */
    const rail = read("components/layout/right-rail.tsx");
    const aside = rail.match(/<aside className="([^"]*)"/)?.[1] ?? "";
    const railWidth = Number(aside.match(/\bw-\[(\d+)px\]/)?.[1] ?? 0);
    assert.ok(railWidth > 0, "could not read the right rail's width");
    assert.match(aside, /\bpr-6\b/, "the rail's right padding changed; the bar mirrors it");
    assert.match(shell, /!wide && "max-w-\[600px\]"/, "the column is no longer 600 wide");
    assert.ok(
      bar.includes(`mx-auto max-w-[600px] lg:max-w-[${600 + railWidth}px] lg:pr-6`),
      `the bar's content is not the column (600) plus the rail (${railWidth}) wide`
    );
  });
});

/**
 * THE BODY UNDER THE DOCK — "there is no vertical line border line so remove
 * that when it is on dock", and "the story... should be exactly below where
 * that logo... so everything will be starting the same line".
 *
 * With the dock in charge there is no sidebar for the column's LEFT hairline to
 * separate it from ("i meant in the left side"), so that one only belongs
 * while the rail is mounted; the right one still divides column from rail. And the
 * top bar's lockup starts on the column's edge, so Home's content drops its
 * left gutter from md up to start on that same line. Phones keep the gutter
 * (the top bar is desktop-only), and so does sidebar mode (no lockup there).
 */
describe("the body under the dock", () => {
  const shell = stripComments(read("components/layout/app-shell.tsx"));
  const feed = stripComments(read("features/feed/components/feed-page.tsx"));
  const css = read("app/globals.css");

  it("drops the column's LEFT hairline under the dock and keeps the right one", () => {
    // "i meant in the left side": the right hairline still divides the column
    // from the rail; the left one would cut down the line the logo starts on.
    const mainBase = shell.match(/"[^"]*min-h-\[calc\(var\(--ws-vvh,100dvh\)-var\(--ws-crumb-h\)\)\][^"]*"/)?.[0] ?? "";
    assert.ok(mainBase, "could not find the column's base classes");
    assert.doesNotMatch(mainBase, /border-x|border-l\b/, "the column's left hairline is unconditional again");
    assert.match(mainBase, /\bws-hair\b/);
    // The right one divides the column from the rail, which is shown from lg.
    assert.match(mainBase, /(^|[\s"])lg:border-r\b/, "the hairline between the column and the rail is gone, or drawn where there is no rail");
    assert.match(shell, /railOn && "border-l"/);
  });

  it("starts Home's content on the logo's line while the dock is on", () => {
    assert.match(feed, /className="ws-align-logo relative px-4 py-4 lg:px-6"/);
    assert.match(
      css,
      /@media \(min-width: 48rem\) \{\s*\[data-rail="off"\] \.ws-align-logo \{\s*padding-left: 0;/,
      "Home's content no longer drops its left gutter under the dock"
    );
  });
});

/**
 * HOME'S TOPIC ROW IS NODE 647:16266 — the live file, updated 2026-09-10.
 *
 * The row was first built from 225:3352. The live node keeps its pill (101 x
 * 38, full round, the 201deg #7E3BEB -> #472185 gradient while selected) and
 * adds one thing: the "For you" pill carries the file's wink glyph (677:18745,
 * exported), 3px before the label, tinted #D8BCFF while selected.
 */
describe("Home's topic row is node 647:16266", () => {
  const tabs = stripComments(read("features/feed/components/topic-tabs.tsx"));

  it("gives For you the file's wink, tinted #D8BCFF while selected", () => {
    assert.match(
      tabs,
      /tab\.key === null && \(\s*<IconForYou className=\{cn\("h-6 w-6 shrink-0", on && "text-\[#D8BCFF\]"\)\} \/>/,
      "the For you pill lost the file's wink"
    );
    assert.match(tabs, /gap-\[3px\]/, "the 3px between the glyph and the label is gone");
    assert.match(tabs, /function IconForYou/);
  });

  it("keeps the file's pill: 101 x 38, round, and its gradient in PIXEL space", () => {
    /*
      The MCP summary converts the file's gradient handles to "201deg 13% ->
      100%", which is the angle in the UNIT square. On a 101 x 38 pill that is
      wrong: projected onto the real box the handles give 226deg with the
      stops at 22.4% and 84.9%, which reproduces the file's render at both ends
      (sampled: left 73,33,137 against 74,34,139; right 125,58,234 against
      126,59,235). 201deg rendered the left end visibly lighter (88,41,166).
    */
    assert.match(tabs, /h-\[38px\] min-w-\[101px\]/);
    assert.match(tabs, /bg-\[linear-gradient\(226deg,#7E3BEB_22\.4%,#472185_84\.9%\)\]/);
    assert.doesNotMatch(tabs, /201deg/, "the unit-square angle is back");
  });
});

/**
 * HOME'S GO LIVE BANNER IS NODE 647:17219 — the live file, updated 2026-09-10.
 *
 * The file draws it 938 x 168 directly under the topic row. The column is 600,
 * so from md up the banner keeps the file's composition and scales as ONE
 * picture to the width it is given (every length a share of 938, via container
 * units), rather than reflowing a two-line headline around a 138px figure.
 * Phones keep the compact strip: no mobile frame was given.
 */
describe("Home's Go Live banner is node 647:17219", () => {
  const cta = stripComments(read("features/streams/components/live-cta.tsx"));
  const feed = stripComments(read("features/feed/components/feed-page.tsx"));
  const home = stripComments(read("components/layout/home-screen.tsx"));

  it("draws the file's 938 x 168 artboard, scaled as one picture from md", () => {
    assert.match(cta, /const DESIGN_W = 938;/);
    assert.match(cta, /const DESIGN_H = 168;/);
    assert.match(cta, /@container/, "the banner no longer scales against its own width");
    assert.match(cta, /hidden md:block/);
  });

  it("paints the gradient in pixel space, not the unit square", () => {
    assert.match(cta, /bg-\[linear-gradient\(92deg,#AD46FF_-16\.3%,#682A99_82%\)\]/);
  });

  it("places the two soft-light strokes from the file's path geometry", () => {
    assert.match(cta, /mixBlendMode: "soft-light"/);
    assert.match(cta, /transform="matrix\(1 0 0 1 -41 -92\)"/);
    assert.match(cta, /transform="matrix\(-1 0 0 -1 992 275\.203125\)"/);
  });

  it("sits on Home right under the topic row, for signed-in readers only", () => {
    assert.match(home, /liveCtaSlot=\{authenticated \? <LiveCta \/> : null\}/);
    const tabs = feed.indexOf("<TopicTabs");
    const banner = feed.indexOf("{liveCtaSlot && ");
    const rooms = feed.indexOf("{roomsSlot}");
    assert.ok(tabs > 0 && banner > tabs && rooms > banner, "the banner is not between the topic row and the rooms");
  });
});

/**
 * HOME'S SUGGESTED GISTROOMS SECTION — the first block of the content column,
 * node 647:16288 (live file, updated 2026-09-10): the heading 1069:11814, View
 * more 1069:11818, the pager dots 647:16289 and the card row 647:17211 of
 * component 415:12668 (default variant 496:13802).
 */
describe("Home's Suggested GistRooms section is 647:16288's first block", () => {
  const rail = stripComments(read("components/layout/live-gist-rooms.tsx"));
  const card = stripComments(read("components/layout/gist-room-card.tsx"));
  const feed = stripComments(read("features/feed/components/feed-page.tsx"));
  const icons = stripComments(read("components/ui/topic-tags-field.tsx"));

  it("heads the carousel with the file's title and View more", () => {
    assert.match(rail, /<span className="text-white">Suggested <\/span>GistRooms/);
    assert.match(rail, /bg-\[linear-gradient\(90deg,#C196FD_0%,#7E3BEB_100%\)\] bg-clip-text/);
    assert.match(rail, /href="\/gist-rooms"/);
  });

  it("spaces it by the file: 85 under the banner, 19 to the dots, 8.67 to cards 17 apart, 78 to what follows", () => {
    assert.match(rail, /mb-\[78px\] mt-\[85px\]/);
    assert.match(rail, /mb-\[19px\]/);
    assert.match(rail, /gap-\[8\.67px\]/);
    assert.match(rail, /gap-\[17px\] overflow-x-auto/);
    assert.match(rail, /justify-start pl-\[5px\]/);
    assert.doesNotMatch(feed, /\{roomsSlot && <div className="mb-6">/, "an empty rooms slot takes space again");
  });

  it("keeps the card at 120 with the Join pill at the file's y", () => {
    assert.match(card, /flex items-center justify-between gap-4/);
    assert.match(card, /flex h-4 items-center gap-1 rounded-full bg-white\/10 px-2 text-\[9px\]/);
    // One 16-tall line: a chip that does not fit whole wraps out of sight
    // instead of growing the card past 120 or being cut in half.
    assert.match(card, /flex h-4 flex-wrap items-center gap-x-1 gap-y-4 overflow-hidden/);
    // The ring is drawn INSIDE, as the file's stroke is, so it takes no width
    // from the 306 content box.
    assert.match(card, /shadow-\[inset_0_0_0_1px_rgba\(255,255,255,0\.18\)\]/);
    assert.doesNotMatch(card, /border border-white\/\[0\.18\]/);
    assert.match(card, /mt-2 space-y-3 pl-8/);
    assert.match(card, /ws-press flex h-5 w-fit items-center gap-\[3px\] rounded-\[30px\] px-3/);
  });

  it("draws the face cluster at 496:13802's geometry", () => {
    assert.match(card, /h-\[55\.62px\] w-\[72\.43px\]/);
    assert.match(card, /left: 12\.31, top: 0, size: 32, rotate: 0/);
    assert.match(card, /left: 38\.27, top: 21\.47, size: 34\.15, rotate: -4/);
    assert.match(card, /left: 0, top: 20\.97, size: 34\.15, rotate: 4/);
  });

  it("gives Religion and Food & Lifestyle the file's exported glyphs", () => {
    assert.match(icons, /religion: IconTopicChurch/);
    assert.match(icons, /food: IconTopicFood/);
  });
});

/**
 * HOME'S "MAKE SOME FRIENDS" — the second block of 647:16288 (live file,
 * updated 2026-09-10): the deck 647:16300, its front card 647:16329, the
 * pills 647:16296 and the rule 647:17210. Home draws its OWN deck; `/pals`
 * keeps 844:18440's.
 */
describe("Home's Make some friends is 647:16288's second block", () => {
  const deck = stripComments(read("components/layout/friends-deck.tsx"));
  const pal = stripComments(read("components/layout/pal-card.tsx"));
  const dots = stripComments(read("components/ui/deck-dots.tsx"));
  const feed = stripComments(read("features/feed/components/feed-page.tsx"));

  it("draws Home's own deck and card, not /pals' at another scale", () => {
    assert.match(deck, /heading === "home" \? HOME_DECK_NODE : DECK_NODE/);
    assert.match(deck, /heading === "home" \? HOME_DECK_CARD : DECK_CARD/);
    assert.match(pal, /export const HOME_DECK_CARD: PalCardNodeGeometry/);
    assert.match(pal, /controls: \{ size: 60\.55, gap: 15\.61, bottom: 25\.76, passGlyph: 35\.84, winkGlyph: 40\.32, lift: 5\.59 \}/);
  });

  it("spaces it by the file: 90 to the deck, 9.38 to five pills, 67 to the rule, 60 to the timeline", () => {
    assert.match(deck, /mt-\[90px\]/);
    assert.match(deck, /mt-\[9\.38px\]/);
    assert.match(deck, /mt-\[67px\] h-\[0\.5px\] bg-white\/25/);
    assert.match(deck, /"mb-\[60px\]"/);
    assert.match(deck, /<DeckDots variant="home" count=\{5\}/);
    assert.match(dots, /w-\[36\.29px\]/);
    assert.match(dots, /h-\[5\.81px\]/);
    assert.doesNotMatch(feed, /\{friendsSlot && <div className="mb-6">/, "an empty friends slot takes space again");
  });

  it("runs the rule to the window's left edge under the dock, with nothing in between cutting it", () => {
    const css = read("app/globals.css");
    const shell = stripComments(read("components/layout/app-shell.tsx"));
    const houses = stripComments(read("components/layout/join-a-community.tsx"));
    assert.match(deck, /ws-rule-to-left-edge -mx-4 mt-\[67px\]/);
    assert.match(css, /\[data-rail="off"\] \.ws-rule-to-left-edge::before \{[^}]*right: 100%;[^}]*width: 100vw;/, "the extension lies over the rule again, doubling it");
    const mainBase = shell.match(/"[^"]*min-h-\[calc\(var\(--ws-vvh,100dvh\)-var\(--ws-crumb-h\)\)\][^"]*"/)?.[0] ?? "";
    assert.ok(mainBase, "could not find the column's base classes");
    assert.doesNotMatch(mainBase, /overflow-x-clip/, "the column clips again, cutting the rule at its edge");
    assert.match(shell, /min-h-dvh w-full overflow-x-clip bg-chrome/, "nothing clips at the window, so the rule scrolls the page sideways");
    assert.match(houses, /ws-bleed-right-only -mx-4 overflow-x-auto/, "the houses rail bleeds past the column's left edge under the dock");
  });
});

describe("Trending discussions close the right rail", () => {
  it("renders the spotlight and partners first, the discussions last", () => {
    const rail = stripComments(read("components/layout/right-rail.tsx"));
    const order = ["<CitizenSpotlightRail", "<EcosystemPartnersRail", "<TrendingDiscussions"].map((tag) => rail.indexOf(tag));
    assert.ok(order.every((i) => i >= 0), "a rail block is missing");
    assert.deepEqual([...order].sort((a, b) => a - b), order, "trending discussions no longer sit last in the rail");
  });
});

/**
 * HOME'S TIMELINE — 647:16354 in the live file (647:16351, updated 2026-09-10).
 * Its cards are 496:13361 redrawn 1.151x larger, so every value here is the
 * live node's divided by 1.151, the scale the post card is built at.
 */
describe("Home's timeline follows 647:16354", () => {
  const feed = stripComments(read("features/feed/components/feed-page.tsx"));
  const post = stripComments(read("features/feed/components/post-card.tsx"));
  const badge = stripComments(read("components/ui/badge.tsx"));
  const css = read("app/globals.css");

  it("spaces the posts 73 / 1.151 apart", () => {
    assert.match(feed, /className="space-y-4 md:space-y-\[63\.42px\]"/);  });

  it("bottom-aligns the action row and sizes the more disc 44.16 / 1.151", () => {
    assert.match(post, /md:flex-row md:items-end md:gap-6/);
    assert.match(post, /ws-glass-pill flex h-\[38\.37px\] w-\[38\.37px\]/);
  });

  it("rings the card at 0.79 / 1.151", () => {
    assert.match(css, /@utility ws-post \{[^}]*border: 0\.69px solid rgba\(255, 255, 255, 0\.1\);/);
  });

  it("draws the post's org badge as its own glyph, not a capsule inside a capsule", () => {
    assert.match(post, /<OrgBadgeChip orgBadge=\{author\.orgBadge\} bare \/>/, "the post header wraps the lockup in a second capsule again");
    assert.match(badge, /bare\s*\?\s*orgBadge === "market"\s*\?\s*"h-\[14px\] w-\[71px\]"/);
    assert.match(badge, /!bare && "rounded-\[21px\] border/, "the capsule is drawn around the bare lockup");
  });
});

describe("The verified badge is the supplied seal", () => {
  const badge = stripComments(read("components/ui/badge.tsx"));
  const seal = block(badge, "export function VerifiedBadge(", "\n}\n");

  it("draws the seal on its own gradient and ring, not the old silver check", () => {
    assert.match(seal, /viewBox="0 0 132 131"/);
    assert.match(seal, /stroke="#9E58FF"/);
    for (const stop of ["#A361FF", "#623A99", "#9F5AFF"]) assert.ok(seal.includes(stop), `the seal lost its ${stop} stop`);
    assert.doesNotMatch(seal, /IconCheck|bg-accent/, "the silver check is back");
  });

  it("gives every seal its own gradient id and still gates on verified alone", () => {
    assert.match(seal, /useId\(\)/, "a shared gradient id lets one seal paint the rest");
    assert.match(seal, /if \(verification !== "verified"\) return null;/);
  });
});

describe("A post answers the pointer in its acts' colours", () => {
  const post = stripComments(read("features/feed/components/post-card.tsx"));
  const css = read("app/globals.css");

  it("rings a hovered post in the brand purple", () => {
    assert.match(css, /\.ws-post:hover \{\s*border-color: var\(--color-create\);/);
  });

  it("colours reply blue, repost green and like red on hover, glyph and count together", () => {
    assert.match(css, /--color-reply: #1d9bf0;/);
    assert.match(post, /label="Comments"\s+count=\{post\.commentCount\}\s+hoverClass="group-hover:text-reply"/);
    assert.match(post, /label="Repost or quote"\s+count=\{post\.repostCount\}\s+hoverClass="group-hover:text-up"/);
    assert.match(post, /activeClass="text-like"\s+hoverClass="group-hover:text-like"/);
    assert.match(post, /<span className=\{cn\("tnum text-\[12px\] leading-4 text-white transition-colors", hoverClass\)\}>/, "the count no longer follows the glyph's hover colour");
  });

  it("colours share blue, the Arkmark purple and the more disc purple on hover", () => {
    assert.match(post, /<GlyphAction label="Share" hoverClass="hover:text-reply"/);
    assert.match(post, /hoverClass=\{bookmark\.unavailable \? undefined : "group-hover:text-create"\}/);
    assert.match(post, /!bookmark\.unavailable && "group-hover:text-create"/, "the Arkmark count no longer follows its glyph");
    assert.match(post, /ws-glass-pill flex h-\[38\.37px\] w-\[38\.37px\] items-center justify-center rounded-full text-grey-100 transition-colors hover:text-create/);
  });
});

describe("A friends card can be posted to Square with a caption", () => {
  const popup = stripComments(read("components/layout/friends-popup.tsx"));
  const composer = stripComments(read("features/feed/components/composer.tsx"));

  it("offers Post beside Download and Share, attaching the same card", () => {
    assert.match(popup, /aria-label="Post this card to Square"/);
    assert.match(popup, /await fetch\(cardImage\)/, "the posted picture is not the card Download saves");
    assert.match(popup, /caption: friendsMomentCaption\(moment\)/);
  });

  it("opens the composer with the card attached and the caption written, and posts nothing by itself", () => {
    assert.match(popup, /prefill=\{\{ link: null, label: null, text: draft\.caption \}\}/);
    assert.match(popup, /initialMedia=\{draft\.file\}/);
    assert.match(composer, /useState<Attachment\[\]>\(\(\) => \(initialMedia \? \[attach\(initialMedia\)\] : \[\]\)\)/);
    assert.doesNotMatch(popup, /create\.mutate|useCreatePost/, "the popup posts on its own instead of through the composer");
  });
});

describe("A wink or follow-back notification opens its card", () => {
  const page = stripComments(read("features/notifications/components/notifications-page.tsx"));
  const popup = stripComments(read("components/layout/friends-popup.tsx"));

  it("opens the card from the row, leaving the row's own buttons alone", () => {
    assert.match(page, /friendsMomentFor\(\{ id: item\.id/);
    assert.match(page, /openFriendsCard\(moment\)/);
    assert.match(page, /closest\("button, a"\)\) return;/, "tapping Wink back or the unread dot also opens the card");
  });

  it("is the same popup, opened on demand", () => {
    assert.match(popup, /const request = useFriendsCardRequest\(\);/);
    assert.match(popup, /setFan\(\[request\.moment\]\)/);
  });
});

describe("Your Story works like WhatsApp's My status", () => {
  const rail = stripComments(read("features/feed/components/stories-row.tsx"));
  const creator = stripComments(read("features/feed/components/story-creator.tsx"));
  const count = (re: RegExp) => (rail.match(re) ?? []).length;

  it("plays your stories when you have some, and opens the creator when you don't or you tap +", () => {
    assert.doesNotMatch(rail, /href="\/\?compose=story"/, "Your Story is a link to the inline composer again");
    assert.equal(count(/const mine = groups\.findIndex\(\(group\) => group\.id === me\.data\?\.id\);/g), 2);
    assert.equal(count(/if \(mine >= 0 && !add\) setOpenAt\(mine\);\s*else setCreating\(true\);/g), 2);
    assert.equal(count(/\{creating && <StoryCreator onClose=\{\(\) => setCreating\(false\)\} \/>\}/g), 2);
    assert.equal(count(/if \(i === mine\) return null;/g), 2, "your own stories show twice in the rail");
  });

  it("posts a photo, video or text story through the ordinary upload and create path", () => {
    assert.match(creator, /create\.mutate\(\{ kind: "story"/);
    assert.match(creator, /upload\.mutateAsync\(stage\.file\)/);
    assert.match(creator, /validateUpload\(file, "media"\)/);
    assert.match(creator, /createPortal\(/);
  });
});

describe("The dock follows 964:24177", () => {
  const dock = stripComments(read("components/layout/bottom-dock.tsx"));

  it("carries Home, Discover, Pals and Chat, with the node's own glyphs", () => {
    for (const glyph of ["dock-home.svg", "dock-discover.svg", "dock-pals.svg", "dock-chat.svg"]) {
      assert.ok(dock.includes(`/notifications/${glyph}`), `${glyph} is not the dock's glyph`);
      assert.ok(existsSync(new URL(`../public/notifications/${glyph}`, import.meta.url)), `${glyph} is missing from public`);
    }
    assert.match(dock, /href: "\/discover", label: "Discover"/);
  });

  it("is the file's bar and circle at 72/113", () => {
    assert.match(dock, /const K = 72 \/ 113;/);
    assert.match(dock, /style=\{\{ width: px\(286\), gap: px\(21\.6\) \}\}/);
    assert.match(dock, /bg-\[rgba\(20,20,22,0\.47\)\]/);
    assert.match(dock, /inset_0_0_0_1\.2px_rgba\(255,255,255,0\.12\)/);
    assert.match(dock, /<stop stopColor="#7E3BEB" \/>\s*<stop offset="1" stopColor="#C27AFF" \/>/);
    assert.match(dock, /strokeWidth="6\.00677"/);
  });
});


describe("The account dropdown follows 747:14001", () => {
  const shell = stripComments(read("components/layout/app-shell.tsx"));
  const items = block(shell, "function AccountMenuItems(", "\nfunction RailHandle(");

  it("offers Profile, Settings, Gender and Log out", () => {
    assert.match(items, /label="Profile"/);
    assert.match(items, /go\(me\.data \? `\/u\/\$\{me\.data\.username\}\/settings` : "\/auth"\)/, "Settings no longer opens the person's own /u/<username>/settings");
    assert.match(items, /setStep\("gender"\)/);
    assert.match(items, /GENDER_OPTIONS\.map\(\(option\) =>/);
    assert.match(items, /update\.mutate\(\{ gender: option\.value \}/);
    assert.doesNotMatch(items, /<input/, "the account menu asks people to type their gender again");
    assert.match(items, /label=\{`Log out @/, "Log out is gone from the account menu");
  });

  it("hangs in the file's 172 panel on both account menus", () => {
    assert.equal((shell.match(/label="Account"\s+align="(?:above|below)"\s+panel="gist"/g) ?? []).length, 2);
    assert.match(shell, /const width = panel === "gist" \? 172 : 224;/);
    assert.match(shell, /border-\[0\.745px\] border-white\/\[0\.18\] bg-grey-800 p-\[11\.913px\]/);
  });
});


describe("Gender is one choice everywhere: Male or Female", () => {
  const places = [
    "components/layout/app-shell.tsx",
    "components/layout/onboarding-flow.tsx",
    "features/profile/components/edit-profile-sheet.tsx",
    "components/layout/friends-filter.tsx",
    "features/discovery/components/people-filters.tsx",
  ];

  it("reads the one list in lib/gender.ts wherever gender is set or filtered", () => {
    for (const path of places) {
      const code = stripComments(read(path));
      assert.match(code, /from "@\/lib\/gender"/, `${path} does not use the shared gender list`);
      assert.match(code, /GENDER_OPTIONS\.map\(/, `${path} draws its own gender options`);
    }
  });

  it("never asks anybody to type a gender", () => {
    const edit = stripComments(read("features/profile/components/edit-profile-sheet.tsx"));
    const explore = stripComments(read("features/discovery/components/people-filters.tsx"));
    const filter = stripComments(read("components/layout/friends-filter.tsx"));
    assert.doesNotMatch(edit, /onChange=\{\(e\) => setGender\(e\.target\.value\)\}/, "Edit profile has a gender text box again");
    assert.doesNotMatch(explore, /placeholder="Gender"/, "Explore has a gender text box again");
    assert.doesNotMatch(filter, /genders\.map/, "the friends filter lists typed spellings again");
  });
});

describe("Each surface asks for its own topics", () => {
  it("Home asks for home, the house tag field for composer, and the key carries the surface", () => {
    const api = stripComments(read("features/discovery/lib/api.ts"));
    const hook = stripComments(read("features/discovery/hooks/use-discovery.ts"));
    assert.match(api, /msApi\.get\("\/topics", surface \? \{ surface \} : undefined\)/);
    assert.match(hook, /queryKey: \["ms", "topics", surface \?\? "all"\]/, "one surface's list could be served to another");
    assert.match(stripComments(read("components/layout/home-screen.tsx")), /useTopics\("home"\)/);
    assert.match(stripComments(read("components/ui/topic-tags-field.tsx")), /useTopics\("composer"\)/);
  });
});

describe("The profile cover follows 1021:20229", () => {
  const cover = stripComments(read("features/profile/components/profile-cover.tsx"));
  const page = stripComments(read("features/profile/components/profile-page.tsx"));
  const chip = stripComments(read("components/layout/profile-kash-chip.tsx"));

  it("puts the camera button on your own avatar, 12 past its edge and 8 below", () => {
    assert.match(cover, /aria-label="Change profile photo"[\s\S]{0,80}absolute -bottom-2 -right-3 h-8 w-8/);
    assert.match(page, /onChangePhoto=\{isMe \? \(\) => setEditOpen\(true\) : undefined\}/);
    for (const asset of ["camera-button.svg", "icon-share.svg", "kash-chevron.svg"]) {
      assert.ok(existsSync(new URL(`../public/profile/${asset}`, import.meta.url)), `${asset} is missing`);
    }
  });

  it("draws the file's cover at 741 and scales it to the card, actions at the identity row's foot", () => {
    assert.match(cover, /md:items-end md:gap-4/);
    assert.match(cover, /relative block shrink-0 md:self-end/, "the avatar floats off the row's foot when the name wraps");
    assert.match(cover, /md:mb-\[5px\] md:gap-4/, "the actions left the identity row's foot, where the file puts them");
    assert.match(cover, /md:h-\[473px\] md:w-\[741px\] md:origin-top-left/, "the cover is no longer drawn at the file's 741x473");
    assert.match(cover, /Math\.min\(1, el\.clientWidth \/ 741\)/, "the file's cover no longer scales to the card");
    assert.match(page, /h-\[38\.37px\] w-\[38\.37px\][\s\S]{0,160}\/profile\/icon-share\.svg/);
    assert.match(page, /text-\[14\.94px\] leading-\[25\.61px\][^"]*md:w-\[129px\] md:gap-\[10\.1px\]/);
    assert.match(chip, /tracking-\[-0\.05px\]/);
    assert.match(chip, /\/profile\/kash-chevron\.svg/);
  });
});

describe("The profile's bio block follows 1021:20271", () => {
  const page = stripComments(read("features/profile/components/profile-page.tsx"));
  it("sits 40 under the cover, bio and labels at 400, counts in #F7F9F9, place and website 14/20 #A1A1AA", () => {
    assert.match(page, /flex flex-col gap-4 px-4 pt-6 md:px-8 md:pt-10/);
    assert.match(page, /"text-\[15px\] font-normal leading-5 text-white\/50"/);
    assert.equal((page.match(/font-semibold text-\[#F7F9F9\]/g) ?? []).length, 2);
    assert.match(page, /gap-y-2 text-\[14px\] font-normal leading-5 text-\[#A1A1AA\]/);
  });
});

describe("The profile draws no creator badge", () => {
  it("keeps the verified seal and the org badge on the cover, and no RoleChip", () => {
    const cover = stripComments(read("features/profile/components/profile-cover.tsx"));
    assert.doesNotMatch(cover, /RoleChip/, "the creator badge is back on the profile");
    assert.match(cover, /<VerifiedBadge verification=\{profile\.verification\}/);
    assert.match(cover, /<OrgBadgeChip orgBadge=\{profile\.orgBadge\} \/>/);
  });
});

describe("Pickers offer the types the service publishes", () => {
  it("builds the composer's and the story creator's accept list from the live limits", () => {
    for (const path of ["features/feed/components/composer.tsx", "features/feed/components/story-creator.tsx"]) {
      const code = stripComments(read(path));
      assert.match(code, /accept=\{acceptFor\("media", limits\)\}/, `${path} hard-codes its accepted types again`);
      assert.doesNotMatch(code, /ACCEPT_MEDIA/, `${path} still uses the compiled-in list`);
    }
  });
});

describe("The profile hides the Creator card for now", () => {
  it("does not render CreatorCard on the profile page, and keeps the verification card", () => {
    const page = stripComments(read("features/profile/components/profile-page.tsx"));
    assert.doesNotMatch(page, /<CreatorCard\b/, "the Creator / Open Studio card is back on the profile");
    assert.match(page, /<VerificationCard \/>/);
  });
});

describe("The profile's Photos row is 1021:20930", () => {
  const photos = stripComments(read("features/profile/components/profile-photos.tsx"));
  const api = stripComments(read("features/profile/lib/api.ts"));
  const page = stripComments(read("features/profile/components/profile-page.tsx"));

  it("reads the gallery, stays absent while it is not deployed, and ends your row in Upload more", () => {
    assert.match(api, /msApi\.get\(`\/profiles\/\$\{username\}\/photos`\)/);
    assert.match(api, /msApi\.post\("\/me\/photos", \{ url \}\)/);
    assert.match(photos, /if \(photos\.unavailable \|\| !photos\.data\) return null;/);
    assert.match(photos, /h-40 w-40 shrink-0 overflow-hidden rounded-\[20px\]/);
    assert.match(photos, /shadow-\[0_4px_25px_0_rgba\(107,107,107,0\.25\)\]/);
    assert.match(photos, /"Upload more"/);
    assert.ok(existsSync(new URL("../public/profile/gallery-add.svg", import.meta.url)));
    assert.match(page, /<ProfilePhotos username=\{data\.username\} isMe=\{isMe\} \/>/);
  });
});

describe("The profile's Houses and tabs follow 1021:20292 and 1021:21615", () => {
  const houses = stripComments(read("components/layout/profile-houses.tsx"));
  const tabs = stripComments(read("features/profile/components/account-tabs.tsx"));
  const page = stripComments(read("features/profile/components/profile-page.tsx"));
  const inbox = stripComments(read("features/messages/components/messages-page.tsx"));

  it("puts View All opposite Houses, opening the inbox on Houses", () => {
    assert.match(houses, /href="\/messages\?tab=houses"[^>]*>\s*View All/);
    assert.match(inbox, /useState<InboxTab>\(tabParam === "houses" \? "houses" : "all"\)/);
  });

  it("leads the strip with Posts on the For you gradient and shows the posts under it", () => {
    assert.match(page, /\{ value: "posts", label: "Posts" \}/);
    assert.match(page, /useState<AccountTab>\("posts"\)/);
    assert.match(page, /accountTab === "posts" && \(\s*<PostsTab/);
    assert.match(tabs, /bg-\[linear-gradient\(226deg,#7E3BEB_22\.4%,#472185_84\.9%\)\] text-grey-100/);
  });
});

describe("The Home banner speaks gist room for now", () => {
  it("says gist room and opens the gist room sheet, not the studio", () => {
    const cta = stripComments(read("features/streams/components/live-cta.tsx"));
    assert.equal((cta.match(/Open a gist room now and/g) ?? []).length, 2);
    assert.equal((cta.match(/href="\/gist-rooms\?open=1"/g) ?? []).length, 2);
    assert.doesNotMatch(cta, />\s*Go Live\s*</, "the banner says Go Live again");
    assert.doesNotMatch(cta, /href="\/studio"/);
  });
});

describe("Profiles share like posts, and the posts sit off the tab strip", () => {
  it("opens the shared ShareSheet from the profile and the more menu", () => {
    const page = stripComments(read("features/profile/components/profile-page.tsx"));
    const menu = stripComments(read("features/profile/components/person-more-menu.tsx"));
    for (const code of [page, menu]) {
      assert.match(code, /from "@\/components\/ui\/share-sheet"/);
      assert.match(code, /<ShareSheet[\s\S]{0,80}title="Share profile"/);
      assert.doesNotMatch(code, /navigator\.share\(/, "the profile shares through the bare device sheet again");
    }
    assert.ok(existsSync(new URL("../components/ui/share-sheet.tsx", import.meta.url)));
  });

  it("keeps the posts 32 under the strip and 32 in, 24 apart", () => {
    const page = stripComments(read("features/profile/components/profile-page.tsx"));
    assert.match(page, /<ul className="flex flex-col gap-6 px-4 pt-8 md:px-8">/);
  });
});

describe("Profile pictures open full size", () => {
  it("opens the avatar, the cover and gallery photos in the one ImageViewer", () => {
    const cover = stripComments(read("features/profile/components/profile-cover.tsx"));
    const photos = stripComments(read("features/profile/components/profile-photos.tsx"));
    assert.match(cover, /aria-label="View cover photo"/);
    assert.match(cover, /aria-label="View profile picture"/);
    assert.match(cover, /<ImageViewer src=\{viewing\.src\}/);
    assert.match(cover, /pointer-events-none absolute inset-0 md:inset-auto/, "the furniture layer swallows taps on the cover again");
    assert.match(photos, /<ImageViewer src=\{open\}/);
  });
});

describe("Posts carry several photos — node 1029:22591", () => {
  it("rails two or more photos on the card and keeps the single frame for one", () => {
    const card = stripComments(read("features/feed/components/post-card.tsx"));
    assert.match(card, /const rail = postMediaList\(post\);/);
    assert.match(card, /rail\.length > 1 \? \(\s*<MediaRail items=\{rail\} \/>/);
  });

  it("only lets the composer pick several once the server has shown it takes lists", () => {
    const composer = stripComments(read("features/feed/components/composer.tsx"));
    assert.match(composer, /const multi = multiSupported && kind === "update";/);
    assert.match(composer, /multiple=\{multi\}/);
    assert.match(composer, /\.\.\.mediaFields\(attached\)/, "the composer must send media through mediaFields, never both fields");
    assert.doesNotMatch(composer, /mediaUrl,\n/);
    const schemas = stripComments(read("lib/api/schemas.ts"));
    assert.match(schemas, /media: z\.array\(PostMediaSchema\)\.optional\(\),/, "a default on media erases the server's answer");
  });
});


describe("A house can be shared with an invite link", () => {
  it("offers Share invite link to whoever may make one and opens the post share sheet", () => {
    const menu = stripComments(read("features/messages/components/thread-menu.tsx"));
    const thread = stripComments(read("features/messages/components/thread.tsx"));
    assert.match(menu, /\{actions\.onShareInvite && \(/);
    assert.doesNotMatch(menu, /label="Copy link"/, "the thread-address copy is back; nobody outside the house can use it");
    assert.match(thread, /const canShareInvite = group && canMakeInvite\(\{ visibility: conversation\.visibility, isOwner \}\);/);
    assert.match(thread, /onShareInvite: canShareInvite \? shareInvite : undefined,/);
    assert.match(thread, /<ShareSheet\s+open\s+onClose=\{\(\) => setInviteLink\(null\)\}\s+title="Share invite link"/);
  });

  it("lands the link on /join/<token>", () => {
    const route = read("app/join/[token]/page.tsx");
    assert.match(route, /<JoinPage token=\{decodeURIComponent\(token\)\} \/>/);
    const page = stripComments(read("features/messages/components/join-page.tsx"));
    assert.match(page, /const state = inviteState\(house, authenticated\);/);
  });
});

describe("Column pages sit on the chrome ground", () => {
  it("paints the sticky column header and empty states like the page, not black", () => {
    const css = read("app/globals.css");
    assert.match(css, /@utility ws-head \{\s*background: var\(--color-chrome\);/);
    const states = stripComments(read("components/ui/states.tsx"));
    assert.doesNotMatch(states.slice(states.indexOf("export function EmptyState"), states.indexOf("export function ErrorState")), /ws-inset/);
  });

  it("opens the profile picture on screen, the seeded mascot included", () => {
    const cover = stripComments(read("features/profile/components/profile-cover.tsx"));
    assert.match(cover, /const avatarSrc = profile\.avatarUrl \?\? artworkForSeed\(resolveSeed\(\{ id: profile\.id, name \}\)\);/);
    assert.match(cover, /disabled=\{!avatarSrc\}/);
  });
});

describe("Tapping a post's words opens the post", () => {
  const card = stripComments(read("features/feed/components/post-card.tsx"));

  it("opens /p/:id from the caption, leaving links, buttons and selections alone", () => {
    assert.match(card, /<div data-post-body onClick=\{full \? undefined : openPost\}/);
    assert.match(card, /target\.closest\("a, button, input, textarea, \[role='button'\]"\)\) return;/);
    assert.match(card, /if \(window\.getSelection\(\)\?\.toString\(\)\) return;/);
    assert.match(card, /router\.push\(`\/p\/\$\{post\.id\}`\);/);
  });

  it("makes the timestamp the post's link everywhere but the post's own page", () => {
    assert.match(card, /<Link href=\{`\/p\/\$\{post\.id\}`\} className="hover:text-white\/80 hover:underline">/);
  });
});

describe("Settings are the reader's own, and show real houses", () => {
  const screen = stripComments(read("components/layout/settings-screen.tsx"));
  const view = stripComments(read("components/layout/notifications-view.tsx"));

  it("sends /u/<someone-else>/settings to the reader's own settings and asks a signed-out visitor to sign in", () => {
    assert.match(screen, /router\.replace\(`\/u\/\$\{me\.data\.username\}\/settings`\);/);
    assert.match(screen, /if \(ready && !authenticated\) \{/);
  });

  it("lists the reader's houses from the inbox query, never invented ones", () => {
    assert.match(view, /const houses = useConversations\("houses"\);/);
    assert.doesNotMatch(view, /DEMO_HOUSES|Ark Gist Partners/);
  });

  it("keeps Upgrade visible and disabled until subscriptions exist", () => {
    assert.match(screen, /<button\s+type="button"\s+disabled\s+title="Subscriptions are coming soon"/);
  });
});

