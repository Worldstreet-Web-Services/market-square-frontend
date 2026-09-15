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
    // The room reserves the bar's own height, since `--ws-nav-h` is 0 there.
    assert.match(room, /pb-\[calc\(80px\+env\(safe-area-inset-bottom,0px\)\)\] md:pb-/, "the room does not reserve its bar's 80px on a phone");
  });
});
