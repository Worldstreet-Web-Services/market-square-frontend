import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * THE DOCK STEPS ASIDE WHILE A ROOM IS LIVE — AND ONLY THEN.
 *
 * Phones first, and since QA (2026-09-15) desktop too: "When a user is in a
 * gistroom listening or speaking, the menu docker shouldn't be displayed".
 *
 * Node 1285:92794 pins the gist room's control bar (1285:93076) to the bottom
 * edge of a phone, where the shell's dock sits. The rule has to reach three
 * places or it is not a rule — the dock must not render, the layout must stop
 * reserving its row, and the room's bar must be the thing at the bottom — and
 * it has to be keyed on the BAR being up, not on the route: a room that has
 * not opened, or has closed, draws no bar and no Back, and a route rule left
 * that phone with no navigation at all.
 */
describe("the live-room dock rule reaches the shell, the stylesheet and the room", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const shell = read("components/layout/app-shell.tsx");
  const css = read("app/globals.css");
  const room = read("features/houses/components/house-room.tsx");
  const bar = read("features/houses/components/room-phone-bar.tsx");

  it("is rung by the bar itself, on mount and off on unmount", () => {
    assert.match(bar, /setRoomBar\(true\);\s*return \(\) => setRoomBar\(false\);/, "the bar does not ring the shell, or leaves it rung after unmounting");
    assert.doesNotMatch(shell, /hidesPhoneDock|dock-surfaces/, "the shell keys the dock on the route again");
  });

  it("hides the dock at every width while a room's bar is up, and nowhere else", () => {
    assert.match(shell, /const roomBar = useRoomBar\(\);/, "the shell no longer listens for a room bar");
    assert.match(
      shell,
      /roomBar && "hidden"/,
      "the dock is not hidden while a live room's bar is up"
    );
    // It no longer waits for a phone breakpoint — that is the QA fix.
    assert.doesNotMatch(shell, /roomBar && "max-md:hidden"/);
    // The rail still decides `md:hidden` on its own.
    assert.match(shell, /railOn && "md:hidden"/);
  });

  it("stamps the wrapper so the stylesheet can stop reserving the dock's row", () => {
    assert.match(shell, /data-dock=\{roomBar \? "room-bar" : "on"\}/);
    assert.match(
      css,
      /\n\[data-dock="room-bar"\] \{\s*--ws-nav-h: 0px;/,
      "the page still pads its foot for a dock that is not drawn"
    );
    // At every width — a phone-only media query here is the desktop band QA saw.
    assert.doesNotMatch(css, /@media \(width < 48rem\) \{\s*\[data-dock="room-bar"\]/);
  });

  it("mounts the room's own bar on the phone, fixed to the bottom edge", () => {
    assert.match(room, /<RoomPhoneBar\b/, "the room draws no bottom bar of its own on a phone");
    assert.match(bar, /fixed inset-x-0 bottom-0 z-40 md:hidden/, "the bar is not pinned to the phone's bottom edge, or leaks onto desktop");
    // The room reserves the bar's height on a phone, since `--ws-nav-h` is 0 there.
    assert.match(room, /pb-\[calc\(64px\+env\(safe-area-inset-bottom,0px\)\)\] md:pb-/, "the room does not reserve its bar's height on a phone");
  });
});

/**
 * THE PHONE BAR IS THE DOCK, NOT A SUMMARY OF IT.
 *
 * The dock is `hidden md:flex`, so below `md` this bar is the ONLY way to any
 * of it. It shipped with four discs and the dock then grew three more controls
 * — the tip pill, the host's moderator sheet and the gift tray — and none of
 * them followed. On a phone a host could not appoint a moderator AT ALL, and
 * the gift tray could only be reached by tapping a person on the stage first
 * (ogazboiz: "the icon for adding moderators why i cant see that ... like gift
 * icon most things that is not reflecting there").
 *
 * NOTHING ABOUT THAT FAILED. Both components typechecked, both were rendered,
 * and the dock's own comment said the phone bar "carries the same controls" —
 * which was true when it was written and quietly stopped being true. A comment
 * cannot notice a new prop; this can.
 */
describe("every control on the desktop dock is reachable on a phone", () => {
  const read = (p: string) =>
    readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const dock = read("features/houses/components/room-dock.tsx");
  const bar = read("features/houses/components/room-phone-bar.tsx");
  const room = read("features/houses/components/house-room.tsx");

  /** The prop names a component destructures, in order. */
  const propsOf = (src: string, component: string): string[] => {
    const start = src.indexOf(`export function ${component}({`);
    assert.notEqual(
      start,
      -1,
      `${component} is not declared the way this test reads it`,
    );
    const body = src.slice(start + `export function ${component}({`.length);
    const end = body.indexOf("}: {");
    assert.notEqual(
      end,
      -1,
      `${component}'s destructure is not followed by its type`,
    );
    return body
      .slice(0, end)
      .split(",")
      .map((entry) => entry.split("=")[0].trim())
      .filter(Boolean);
  };

  it("the phone bar takes every prop the dock takes", () => {
    const dockProps = propsOf(dock, "RoomDock");
    const barProps = new Set(propsOf(bar, "RoomPhoneBar"));
    // `className` is the dock's own placement in a scrolling column; the bar is
    // fixed to the viewport and has nowhere to be placed.
    const missing = dockProps.filter(
      (prop) => prop !== "className" && !barProps.has(prop),
    );
    assert.deepEqual(
      missing,
      [],
      `the dock has controls the phone cannot reach: ${missing.join(", ")}`,
    );
    // The guard is only worth having if it is reading real props.
    assert.ok(dockProps.includes("onPeople") && dockProps.includes("onGift"));
  });

  it("and the room hands the phone bar the SAME handlers, not different ones", () => {
    // Two call sites in one file, which is exactly how they drifted. Compared
    // as text: a moderator sheet opened with a different guard, or a gift tray
    // opened with somebody pre-selected, is the bug this pair exists to catch.
    const moderators =
      /onPeople=\{canManageModerators \? \(\) => setModeratorsOpen\(true\) : null\}/g;
    assert.equal(
      [...room.matchAll(moderators)].length,
      2,
      "the two bars open moderators differently",
    );

    const gift =
      /onGift=\{\(\) => \{\s*setGiftTo\(null\);\s*setGiftsOpen\(true\);\s*\}\}/g;
    assert.equal(
      [...room.matchAll(gift)].length,
      2,
      "the two bars open the gift tray differently",
    );

    const tip =
      /primary=\{isHost \? null : \(tipSlot\?\.\(stream\.id, stream\.owner\) \?\? null\)\}/g;
    assert.equal(
      [...room.matchAll(tip)].length,
      2,
      "the audience cannot tip from one of the two bars",
    );
  });

  it("draws them as real discs, with the dock's own glyphs", () => {
    // Shared from `room-icons`, never redrawn per bar: two hand-drawn copies of
    // one mark drift, and the drift is invisible because they never appear on
    // the same screen.
    assert.match(bar, /<IconRoomPeople \/>/);
    assert.match(bar, /<IconRoomGift \/>/);
    assert.match(dock, /<IconRoomPeople \/>/);
    assert.match(dock, /<IconRoomGift \/>/);
    assert.doesNotMatch(
      bar,
      /function IconRoom(People|Gift)/,
      "the phone bar redraws a shared glyph",
    );
    assert.doesNotMatch(
      dock,
      /function IconDock(People|Gift)/,
      "the dock still holds its own copy",
    );

    assert.match(bar, /aria-label="Manage moderators"/);
    assert.match(bar, /aria-label="Send a gift"/);
  });

  it("fits the narrowest phone this app claims to support", () => {
    /*
      360, not the file's 390. The audience row is the widest case — the tip
      pill at 98, five 40px discs and the gaps between all six — and at the
      file's 24px gutter and 8px gap it comes to 386 of content, which runs off
      a 360 Android and a 375 iPhone SE. The right-most disc does not wrap or
      shrink; it leaves the screen, and the control simply is not there.
    */
    assert.match(
      bar,
      /gap-1\.5 border-t border-white\/10 px-4 sm:gap-2 sm:px-6/,
    );
    const PILL = 98,
      DISC_W = 40,
      DISCS = 5,
      GAP = 6,
      GUTTER = 16;
    const widest = PILL + DISCS * DISC_W + DISCS * GAP + 2 * GUTTER;
    assert.ok(widest <= 360, `the widest row is ${widest}px on a 360px phone`);

    // The label is what gives way if it ever does not fit — losing a whole
    // disc off the right edge is the worse failure.
    assert.match(
      bar,
      /<div className="flex min-w-0 shrink items-center">\{primary\}<\/div>/,
    );
    assert.match(
      bar,
      /<div className="flex shrink-0 items-center gap-1\.5 sm:gap-2">/,
    );
  });
});
