import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const room = source("features/houses/components/house-room.tsx");
const people = source("features/houses/components/room-people.tsx");
const panel = source("features/houses/components/room-roster-panel.tsx");
const screen = source("components/layout/house-room-screen.tsx");

/** The `<aside>` — the room's third column, 411 wide from `xl`. */
const aside = room.slice(
  room.indexOf('<aside className="ws-hair flex w-full'),
  room.indexOf("</aside>")
);

/*
  "VIEW ALL" OPENS THE ROSTER IN THE THIRD COLUMN — node 369:8740.

  Three things have to hold together and each broke on the way here, so each is
  pinned rather than described:

    · the tile has to be OFFERED (nothing passed `onViewAll` at first, so it
      never rendered and there was nothing behind it),
    · the grid has to TRUNCATE to make room for it (the cap gated the tile and
      sliced nothing, so sixteen members drew three ragged rows), and
    · the panel has to land in the CHAT'S column rather than under the grid.
*/

test("the roster opens in the room's third column, not anywhere else", () => {
  assert.match(
    aside,
    /<RoomRosterPanel/,
    "the roster is no longer rendered inside the chat's column"
  );
  // Exactly one place mounts it: two would mean a panel under the grid as well.
  assert.equal(
    (room.match(/<RoomRosterPanel/g) ?? []).length,
    1,
    "the roster is mounted more than once in the room"
  );
});

test("opening it HIDES the chat rather than unmounting it", () => {
  /*
    Unmounting would throw away the chat's scroll position and restart its 5s
    poll every time somebody glanced at the roster. `hidden` keeps both, so
    closing the panel puts the reader back exactly where they were.
  */
  assert.match(
    aside,
    /roster && "hidden"/,
    "the chat is unmounted while the roster is open, losing its scroll and its poll"
  );
  assert.match(aside, /<ChatPanel\b/, "the chat left the column entirely");
});

test("both sections offer the tile, and only when there is more than the grid shows", () => {
  // The audience, in the room itself.
  assert.match(
    room,
    /audiencePeople\.length > GRID_CELLS/,
    "the audience offers View all regardless of how many people are in it"
  );
  // House members, composed in — the room may not fetch a house roster.
  assert.match(
    screen,
    /people\.length > GRID_CELLS/,
    "house members offers View all regardless of how many members there are"
  );
  assert.match(
    screen,
    /onViewAll\("House Members", people\)/,
    "house members no longer hands its list up to the room"
  );
});

test("the grid truncates so the tile IS the twelfth cell", () => {
  /*
    369:9221 draws six across and six again with View all as the last cell —
    eleven people and the tile. Rendering every person AND the tile is what made
    a sixteen-member house three rows.
  */
  assert.match(
    people,
    /people\.slice\(0, GRID_CELLS - 1\)/,
    "the grid renders every person plus the tile again"
  );
  assert.match(
    people,
    /onViewAll \? people\.slice/,
    "the grid truncates even when there is no panel to send anybody to"
  );
});

test("one cap, shared — the offer and the grid cannot disagree", () => {
  // Capped at twelve in one place and gated at ten in another would either hide
  // people silently or open a panel identical to the grid above it.
  assert.match(people, /export const GRID_CELLS = 12;/, "the cap stopped being shared");
  assert.doesNotMatch(room, /const GRID_TILES/, "the room kept its own copy of the cap");
  assert.doesNotMatch(screen, /const GRID_TILES/, "the screen kept its own copy of the cap");
});

test("a row with no handle offers no controls and links nowhere", () => {
  /*
    The audience is built from LiveKit identities, which carry no username and
    no follower count. A follow has to be addressed to somebody, so those rows
    are inert rather than dead — and they must never link to `/u/undefined`.
  */
  assert.match(
    panel,
    /\{person\.username && \(/,
    "the panel offers follow controls for people it cannot name"
  );
  assert.match(
    panel,
    /if \(!username\) return <span/,
    "the panel links a row it has no handle for"
  );
});

test("the avatar is seeded on the USER id, not the room identity", () => {
  /*
    A LiveKit identity carries a role suffix (`#speaker`, `#broadcaster`) and a
    user id never does, so seeding on the identity draws a different generated
    face in the panel than the grid draws for the same person.
  */
  assert.match(
    panel,
    /seed=\{person\.userId \?\? person\.id\}/,
    "the panel seeds avatars on the room identity again"
  );
});
