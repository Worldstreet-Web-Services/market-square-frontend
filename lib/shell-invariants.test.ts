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
  const deck = stripComments(read("components/layout/make-some-friends.tsx"));
  /*
    The CARD is `PalCard`, shared with the "Suggested Pals" rail (540:19351) —
    one object drawn at two sizes, because two copies of this markup is how a
    wink cooldown gets fixed on one surface and not the other. So the badge, the
    photo and the two controls are asserted there, and the FAN — placement,
    tilt, scale, re-centring — is still asserted against the deck.
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

  it("sits INSIDE the card, as the file places it", () => {
    // Node 225:3412 is at x=137.28 in a 183.7 card — a 7.29px inset. The badge
    // hung 8px off the right edge, which is what made it read as stuck onto
    // the photo rather than part of the card.
    assert.doesNotMatch(
      card,
      /-right-2/,
      "the follow badge hangs outside the card again"
    );
    // The inset is a NUMBER now, not a class: the deck's card and the rail's
    // place the badge at 7 and 6.77 in cards of different widths, so it is
    // passed in with the rest of the geometry rather than hard-coded.
    assert.match(card, /right: g\.badge\.inset/, "the badge lost the file's inset");
    assert.match(deck.concat(card), /inset: 7\b/, "the deck's own 7px inset is gone");
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

  it("draws every card at FULL strength — the file's fills carry their own alpha", () => {
    // The neighbours were rendered at `opacity: 0.55`, which washed the
    // white-to-#D0B3FF card out to grey against the black page. Depth in this
    // deck comes from overlap and from the front card being raised; the only
    // transparency in it belongs to the fills themselves — pass is #9F65FD at
    // 23% inside its own exported glyph.
    assert.doesNotMatch(
      deck.concat(card),
      /opacity:\s*front \?/,
      "the deck dims its neighbouring cards again — the file draws all three opaque"
    );
  });

  it("ROTATES the two neighbours — node 225:3374 tilts them", () => {
    // This test used to assert the exact opposite, and it was wrong. Every one
    // of the three cards carries a `relativeTransform`, and two of them turn:
    // -9.27 and +9.90 degrees. The tilt is most of what makes the group read as
    // a deck rather than three overlapping rectangles.
    assert.match(deck, /rot: -9\.27/, "the left card lost the file's tilt");
    assert.match(deck, /rot: 9\.9/, "the right card lost the file's tilt");
    assert.match(deck, /rotate\(\$\{place\.rot\}deg\)/, "the tilt is no longer applied");
  });

  it("draws the neighbours SMALLER than the card in front — not larger", () => {
    /*
      The trap this pins. The file's neighbours report 205.55 and 207.76 wide
      against the front card's 183.70, which reads as "the back cards are
      bigger". Those are the bounding boxes of ROTATED cards. Solve the rotation
      out and both are 170.5 — the same card at 92.79%.

      Built from the AABBs, this deck had its neighbours at 1.119 and 1.131, so
      the back cards were larger than the one being offered.
    */
    const scales = [...deck.matchAll(/scale: ([\d.]+)/g)].map((m) => Number(m[1]));
    assert.ok(scales.length >= 3, "the deck stopped declaring its scales");
    for (const scale of scales) {
      assert.ok(scale <= 1, `a neighbour is scaled to ${scale} — larger than the front card`);
    }
    assert.match(deck, /scale: 0\.9279/, "the neighbours lost the file's 92.79%");
  });

  it("re-centres a fan that is not full", () => {
    // The file draws three. With one or two people on the square the remaining
    // cards sat off to one side of an empty row.
    assert.match(deck, /drawn\.length < 3/, "a short deck is lopsided again");
  });

  it("places the three cards from the file rather than a formula", () => {
    assert.match(deck, /DECK_PLACES/, "the deck is generating positions again");
  });

  it("reads the follow edge rather than the raw field", () => {
    assert.match(card, /useIsFollowing\(profile\)/, "a missing isFollowing can now fabricate Following");
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
