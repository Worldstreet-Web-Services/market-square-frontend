"use client";

/**
 * The floating create-post button. ONE of these exists, in AppShell.
 *
 * It used to be three: a `sticky bottom-6` copy inside `<main>` on desktop, a
 * `fixed` copy for mobile, and a third inside the mobile snap feed. The sticky
 * one is why it appeared to move between pages — a sticky element is only
 * pinned while its containing block is in view, so on a short route it stranded
 * at the end of the content instead of holding the viewport corner. Fixed
 * positioning, mounted once outside `<main>`, is what makes it identical
 * everywhere.
 *
 * Geometry is the design's, unrounded:
 *   - 71x71 transparent hit frame, contents pushed to flex-end and centred
 *   - 52.79487px visual circle inside it (9.10256px padding all round)
 *   - "+" at 32.7692px Geist 500, white
 *
 * The hit frame stays larger than the circle on purpose — that margin is the
 * comfortable tap target — so the visible edge inset is the frame inset plus
 * 9.10256px.
 */
export function CreateFab({
  onClick,
  label = "Create post",
}: {
  onClick: () => void;
  /**
   * What this corner does on THIS surface.
   *
   * The gist rooms page (407:17286) draws the same circle in the same corner
   * and it opens a ROOM, not a post — so the shape is shared and the act is
   * the caller's. Only the accessible name changes: the glyph is a plus in
   * both, because the file draws a plus in both.
   */
  label?: string;
}) {
  return (
    <div
      // Bottom inset differs by breakpoint for one reason only: the mobile tab
      // bar. --ws-fab-bottom is defined in globals.css so the bar's height and
      // the button's clearance cannot drift apart.
      // `hidden md:flex`: the phone has its own create button, sitting IN the
      // tab bar's row rather than on top of it. Two fixed circles in one corner
      // is what this used to be.
      //
      // IT TRACKS THE SHELL'S EDGE, NOT THE WINDOW'S. It has to stay `fixed`
      // so it does not scroll away, but `right-[10px]` measured from the
      // viewport, and the shell is now capped at `--ws-shell-max` and centred
      // — so on any monitor wider than that, the button would sit out in the
      // gutter with nothing under it, orphaned from the column it composes
      // into. The same cap and the same `mx-auto` put it back on the frame's
      // own edge, and `inset-x-0` is what gives `mx-auto` something to centre
      // within. Below the cap this is identical to the old positioning.
      //
      // The strip spans the frame, so it is `pointer-events-none` and only the
      // button takes them back — otherwise an invisible full-width bar would
      // sit over the foot of every page swallowing clicks.
      className="pointer-events-none fixed inset-x-0 z-40 mx-auto hidden w-full max-w-[var(--ws-shell-max)] justify-end px-[10px] md:flex"
      style={{ bottom: "var(--ws-fab-bottom)" }}
    >
      <div className="pointer-events-auto flex h-[71px] w-[71px] items-center justify-end p-[9.10256px]">
        <button
          onClick={onClick}
          aria-label={label}
          className="ws-btn-fab ws-press flex h-[52.79487px] w-[52.79487px] items-center justify-center rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-opacity hover:opacity-90"
        >
          {/*
          The design's type is 32.7692px on a 20px line-height — a line box
          shorter than the glyph, which would sit low if it were laid out
          normally. Flex centring plus leading-none is what actually optically
          centres it; the type values stay exactly as specified.
        */}
          <span
            aria-hidden
            className="block leading-none"
            style={{
              fontSize: "32.7692px",
              fontWeight: 500,
              lineHeight: "20px",
            }}
          >
            +
          </span>
        </button>
      </div>
    </div>
  );
}
