"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { SquareMark, type SquareMarkPalette } from "@/components/ui/square-mark";
import { useUnread } from "@/hooks/use-unread";

/**
 * THE DESKTOP DOCK — node 748:15721, and there is no sidebar beside it.
 *
 * A translucent pill carrying three destinations, and a compose circle beside
 * it. It replaces the labelled sidebar outright on desktop, at ogazboiz's
 * instruction, with the consequence understood and accepted: the sidebar
 * carried ELEVEN destinations and this carries three.
 *
 * ─── WHAT IS NO LONGER LINKED FROM ANYWHERE ON DESKTOP ──────────────────────
 * Gistrooms, Notifications, Live, Library, Store, Studio, Admin and
 * Operations. Every one of those ROUTES still works and every deep link into
 * them still resolves — nothing was deleted — but nothing on a desktop screen
 * points at them any more. They remain reachable on a phone, where the tab
 * bar's More drawer still lists the whole nav.
 *
 * Written down because it is the kind of decision that looks like a bug to
 * whoever finds it next: the answer is that it was asked for, and the way to
 * reverse it is to put `Sidebar` back in `AppShell`.
 *
 * ─── THE FILE'S GEOMETRY IS A RESIZED GROUP ─────────────────────────────────
 * It is drawn 368.91 x 113 with a 63.147 home circle, a 39.88 icon and a 9.9px
 * label — fractions that come from a group somebody scaled, not from decisions.
 * So the PROPORTIONS are the file's and the size is ours: the dock is 72 tall
 * (the file's 113 would be an enormous bar on a laptop), everything else scaled
 * by the same 0.637, and the label kept at 10px rather than scaled down to the
 * 6px that ratio would give — a label nobody can read is not the design either.
 *
 * Colours and materials ARE the file's exactly: `#141416` at 47% behind a
 * backdrop blur, and the compose circle on `--color-spotlight` ->
 * `--color-spotlight-chip-ink`, which are the ramp's own two stops rather than
 * a new purple.
 */

/**
 * THE MARK'S OWN PALETTE IN THIS DOCK — 748:15725, and it is NOT the brand one.
 *
 * `SQUARE_MARK_BRAND` runs the card `#7E3BEB` -> `#472185` over a `#7E3BEB`
 * side. The dock's copy runs it the other way and lighter — `#C19CFE` ->
 * `#7E3BEB` — and its side is `#2D2D2E`, a near-black grey rather than purple.
 * Read off the node rather than assumed, because `LogoMark` was rendering the
 * brand palette here and the difference is plain at a glance: the file's mark
 * is a pale violet face on a dark edge, ours was a saturated one on a purple
 * edge.
 *
 * The bubble is white over `#D9D9D9`, which is the mark's own two greys.
 */
const DOCK_MARK: SquareMarkPalette = {
  cardA: "#C19CFE",
  cardB: "#7E3BEB",
  bubbleA: "#D9D9D9",
  bubbleB: "#FFFFFF",
  ink: "#2D2D2E",
};

interface DockItem {
  href: string;
  label: string;
  /** Exported from the node; the file's grey is mapped to `currentColor`. */
  glyph: string;
  /** Live count, or null where we genuinely do not have one. */
  badge?: number | null;
}

export function BottomDock({
  onCompose,
  guest = false,
  className,
}: {
  onCompose?: () => void;
  /**
   * Only ever `md:hidden`, and only when `MARKET_FLAGS.sidebar` is on — the
   * rail takes desktop navigation back and the dock stays on phones. It lives
   * at the call site rather than here so this component has no opinion about
   * a flag it does not read.
   */
  className?: string;
  /**
   * Signed out. Chat is dropped rather than shown leading to a sign-in wall —
   * the same judgement the sidebar made when it hid itself entirely from
   * guests: a row that can only refuse you is not navigation.
   */
  guest?: boolean;
}) {
  const pathname = usePathname();
  const unread = useUnread();

  const all: DockItem[] = [
    { href: "/", label: "Home", glyph: "" },
    /*
      THE FILE DRAWS A "4" ON THIS ONE AND WE DO NOT DRAW ANYTHING.

      There is no count behind the people glyph: `GET /me/unread` answers
      messages and notifications, and neither is "pals". A badge is a promise
      that something is waiting, so an invented one is the worst kind of
      decoration — it sends somebody looking for news that does not exist.
      It appears the day a count does.

      IT POINTS AT THE DECK, NOT AT EXPLORE. The glyph promises deciding about
      one person at a time; Explore is a directory you scan. `/pals` is the
      same `MakeSomeFriends` the timeline carries, given a page of its own.
    */
    { href: "/pals", label: "Pals", glyph: "/notifications/dock-pals.svg", badge: null },
    {
      href: "/messages",
      label: "Chat",
      glyph: "/notifications/dock-chat.svg",
      // The real global unread, the same number the bell reads.
      badge: unread.data?.messages ?? null,
    },
  ];

  // Home and Pals are public surfaces; Chat is not.
  const items = guest ? all.filter((item) => item.href !== "/messages") : all;

  return (
    /* EVERY WIDTH, not just desktop. It replaced the sidebar first and the
       phone's tab bar second, so it is the app's only bottom navigation now.
       The inset clears the home indicator on a phone and is the file's 24
       everywhere else. */
    <div
      className={cn("pointer-events-none fixed inset-x-0 z-40 flex justify-center", className)}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
    >
      <div className="pointer-events-auto flex items-center gap-2">
        {/* 748:15722 — `#141416` at 47%, fully round, behind a heavy backdrop
            blur and the file's own deep shadow. */}
        {/* `ws-glass` — the app's own material, not a second one invented here.
            It is `rgba(20,20,22,0.7)` behind a 16px blur with a 10% white
            hairline and an inset top highlight, and `#141416` is exactly the
            colour the file gives this pill. The file's 47% against the
            utility's 70% is the one difference, and the utility wins: it is
            what every other floating surface in the app is made of, and a
            dock a shade more solid than the rest is a new material nobody
            asked for. */}
        <nav
          aria-label="Primary"
          className="ws-glass flex h-[72px] items-center gap-[14px] rounded-full px-[18px] shadow-[0_22px_60px_-19px_rgba(0,0,0,0.95)]"
        >
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "ws-press relative flex flex-col items-center justify-center gap-1 rounded-full transition-colors",
                  // The active item is the wider one in the file: it carries a
                  // label the others do not.
                  active ? "w-10 text-white" : "w-[25px] text-[#9B9B9B] hover:text-white"
                )}
              >
                <span className="relative">
                  {item.href === "/" ? (
                    // Home is the product's own mark, which we already have as
                    // a component — not a second copy of it as an asset.
                    <SquareMark width={26} palette={DOCK_MARK} className="h-auto w-[26px]" />
                  ) : (
                    /*
                      MASKED, NOT AN <img>.

                      The exported glyphs carry the file's grey as
                      `currentColor` so one asset can serve both states — but an
                      SVG loaded through `<img src>` is a SEPARATE DOCUMENT and
                      cannot see this page's `color`, so `currentColor` resolved
                      to its own default and both icons rendered BLACK on a dark
                      dock. Painting them as a mask puts the colour back under
                      CSS's control: the shape comes from the file, the ink from
                      the link's own `text-…`, which is `#9B9B9B` at rest and
                      white when it is the current page — exactly what 748:15734
                      and 748:15739 specify.
                    */
                    <span
                      aria-hidden
                      className="block h-[25px] w-[25px] bg-current"
                      style={{
                        maskImage: `url(${item.glyph})`,
                        WebkitMaskImage: `url(${item.glyph})`,
                        maskSize: "contain",
                        WebkitMaskSize: "contain",
                        maskRepeat: "no-repeat",
                        WebkitMaskRepeat: "no-repeat",
                        maskPosition: "center",
                        WebkitMaskPosition: "center",
                      }}
                    />
                  )}
                  {/* 748:15735 — the badge, drawn only when there is a real
                      number behind it. */}
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="tnum absolute -right-2 -top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-spotlight px-1 text-[9px] font-bold leading-none text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </span>
                {/* 748:15732 — only the active item is labelled. Manrope in the
                    file; Geist here, since that is the app's face. */}
                {active ? (
                  <span className="text-[10px] font-bold leading-none">{item.label}</span>
                ) : (
                  <span className="sr-only">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* 748:15743 — 113 in the file, 72 here, on the ramp's own two stops at
            the file's 201deg. */}
        {onCompose && (
          <button
            type="button"
            onClick={onCompose}
            aria-label="Create post"
            className="ws-press grid h-[72px] w-[72px] place-items-center rounded-full bg-[linear-gradient(201deg,var(--color-spotlight)_0%,var(--color-spotlight-chip-ink)_100%)] text-white shadow-[0_22px_60px_-19px_rgba(0,0,0,0.95)] transition-opacity hover:opacity-90"
          >
            <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden>
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
