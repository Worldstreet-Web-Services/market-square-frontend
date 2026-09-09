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
export function CreateFab({ onClick }: { onClick: () => void }) {
  return (
    <div
      // Bottom inset differs by breakpoint for one reason only: the mobile tab
      // bar. --ws-fab-bottom is defined in globals.css so the bar's height and
      // the button's clearance cannot drift apart.
      // `hidden md:flex`: the phone has its own create button, sitting IN the
      // tab bar's row rather than on top of it. Two fixed circles in one corner
      // is what this used to be.
      className="fixed right-[10px] z-40 hidden h-[71px] w-[71px] items-center justify-end p-[9.10256px] md:flex"
      style={{ bottom: "var(--ws-fab-bottom)" }}
    >
      <button
        onClick={onClick}
        aria-label="Create post"
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
          style={{ fontSize: "32.7692px", fontWeight: 500, lineHeight: "20px" }}
        >
          +
        </span>
      </button>
    </div>
  );
}
