"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useTrackNavHistory } from "@/lib/nav-history";
import { type RailState, railFromDrag, railWidth, toggleRail } from "@/lib/sidebar-rail";
import { useRailState } from "@/lib/sidebar-rail-store";
import { allowsCompose } from "@/lib/compose-surfaces";
import { MARKET_FLAGS } from "@/lib/market-config";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { useLogout } from "@/hooks/use-logout";
import { useBroadcastStatus } from "@/hooks/use-broadcast-status";
import { ClaimUsernameGate } from "@/features/profile";
import { useUnread } from "@/hooks/use-unread";
import { SessionGuard } from "@/components/layout/session-guard";
import { Avatar } from "@/components/ui/avatar";
import { LogoMark, Wordmark } from "@/components/ui/wordmark";
import { RightRail } from "@/components/layout/right-rail";
import { CreateFab } from "@/components/layout/create-fab";
import { ComposeSheet } from "@/components/layout/compose-sheet";
import { Sheet } from "@/components/ui/sheet";
import {
  IconBell,
  IconBookmark,
  IconCalendar,
  IconChevronLeft,
  IconCamera,
  IconDots,
  IconExternal,
  IconHome,
  IconLive,
  IconMail,
  IconMore,
  IconPlus,
  IconSearch,
  IconSpark,
  IconShield,
  IconStore,
  IconTicket,
  IconUser,
} from "@/components/ui/icons";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; filled?: boolean }>;
  authed?: boolean;
  operator?: boolean;
  /** Operator console — shown only to accounts the service flags as admin. */
  admin?: boolean;
  /** Folded into the "More" menu below xl, where vertical room runs out. */
  secondary?: boolean;
  /**
   * Hidden unless this `MARKET_FLAGS` capability is on.
   *
   * Promotion only — the ROUTE stays reachable either way. Hiding the entry
   * must never break a deep link into the surface it points at.
   */
  flag?: keyof typeof MARKET_FLAGS;
  /**
   * An absolute URL to another product rather than a route in this app.
   *
   * External entries never take the active state (no pathname can match an
   * absolute URL) and never appear in the mobile bar, whose four slots belong
   * to the surfaces people move between constantly.
   */
  external?: boolean;
}

/**
 * Where the rest of WorldStreet lives.
 *
 * The confirmed public origin. `NEXT_PUBLIC_WORLDSTREET_URL` still overrides
 * it, so a staging build can point the entry somewhere else without a code
 * change.
 *
 * Deliberately NOT `NEXT_PUBLIC_ARK_APP_URL`: that variable is the base for
 * every deep-link CTA (listings, markets, casino games), and `lib/deeplink.ts`
 * keeps those CTAs INERT while it is unset precisely so nobody is sent to a
 * host that answers nothing. Setting it to a placeholder to get one nav link
 * would quietly turn all of them into placeholder links too.
 */
const WORLDSTREET_URL = process.env.NEXT_PUBLIC_WORLDSTREET_URL ?? "https://worldstreetgold.com";

// One ordered list drives the sidebar at every breakpoint. Primary items are
// always visible; secondary ones collapse into More on shorter rails.
//
// Spotlight has a nav entry because the right rail, which used to be its only
// door, is `hidden lg:block` — so below lg there was no way to reach it at all.
// The "second door to the same room" argument only holds where the first door
// exists, and on a phone it does not.
const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/discover", label: "Explore", icon: IconSearch },
  { href: "/messages", label: "Messages", icon: IconMail, authed: true },
  { href: "/notifications", label: "Notifications", icon: IconBell, authed: true },
  { href: "/live", label: "Live", icon: IconLive },
  { href: "/tickets", label: "Tickets", icon: IconTicket, authed: true },
  // Arkmarks had a route and a save button on every post, and no way in: the
  // only path to something you saved was typing the URL.
  { href: "/arkmarks", label: "Arkmarks", icon: IconBookmark, authed: true, secondary: true },
  { href: "/spotlight", label: "Spotlight", icon: IconSpark, secondary: true },
  // Reachable by URL, by deep link and from Explore's Products tab — just
  // not promoted in the nav while `storeNav` is off.
  { href: "/store", label: "Store", icon: IconStore, flag: "storeNav" },
  { href: "/schedule", label: "Schedule", icon: IconCalendar, authed: true, secondary: true },
  { href: "/studio", label: "Studio", icon: IconCamera, authed: true },
  { href: "/admin", label: "Admin", icon: IconShield, authed: true, admin: true, secondary: true },
  { href: "/operations", label: "Operations", icon: IconShield, authed: true, operator: true, secondary: true },
  // The way back to the rest of the platform. Market Square is one surface of
  // WorldStreet, and without this the two products have no door between them.
  { href: WORLDSTREET_URL, label: "WorldStreet", icon: IconExternal, external: true, secondary: true },
];

// Surfaces that need the full width: grids and dashboards drown inside a
// 600px reading column, so they drop the right rail and spread instead.
// Everything list-shaped stays in the column — including the Studio index and
// Schedule, whose rows read worse stretched across 1000px. Their detail views
// (the cockpit) are a different matter, hence the separate prefix list.
/**
 * Which nav entries this viewer may see.
 *
 * Sidebar, mobile bar and mobile drawer all read the same list, so the rule
 * lives here once — three copies is how a flagged entry survives in one of
 * them.
 */
function visibleNav(options: {
  authenticated: boolean;
  isAdmin: boolean;
  isOperator: boolean;
}): NavItem[] {
  return NAV.filter(
    (item) =>
      (!item.authed || options.authenticated) &&
      (!item.operator || options.isOperator) &&
      // Presentation only. Every /admin route is enforced server-side, so a
      // non-admin who types the URL still gets a refusal.
      (!item.admin || options.isAdmin) &&
      (!item.flag || MARKET_FLAGS[item.flag])
  );
}

const WIDE_EXACT = ["/store", "/operations"];
const WIDE_PREFIX = ["/store/", "/operations/", "/studio/"];

function isWide(pathname: string): boolean {
  return (
    WIDE_EXACT.includes(pathname) || WIDE_PREFIX.some((prefix) => pathname.startsWith(prefix))
  );
}

// Which surfaces carry a compose control — the rules and their reasoning live
// in lib/compose-surfaces.ts, where they are pinned by tests.

function isActive(pathname: string, href: string): boolean {
  // An absolute URL is another product, never the current route.
  if (/^https?:\/\//i.test(href)) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function OnAirPill({ streamId, compact }: { streamId: string | null; compact?: boolean }) {
  return (
    <Link
      href="/studio"
      aria-label="You're live — back to the studio"
      title="You're live — back to the studio"
      className={cn(
        "ws-press flex items-center gap-1.5 rounded-full bg-accent font-bold uppercase tracking-wider text-ink",
        compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"
      )}
      data-stream={streamId ?? undefined}
    >
      <span className="ws-live-dot h-1.5 w-1.5 rounded-full bg-ink" />
      Live
    </Link>
  );
}

/**
 * Sidebar row.
 *
 * The design draws a nav item as a 12px-radius capsule with a 16px glyph and a
 * 12px bold label — and marks the active one by filling it at 10% white,
 * ringing it at 15%, and turning its glyph amber. That amber dot is the only
 * hue in the rail.
 */
function NavLink({
  item,
  active,
  badge = 0,
}: {
  item: NavItem;
  active: boolean;
  /** Unread tally shown on the glyph. 0 renders nothing. */
  badge?: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={
        item.external
          ? `${item.label} (opens in a new tab)`
          : badge > 0
            ? `${item.label}, ${badge} unread`
            : item.label
      }
      aria-current={active ? "page" : undefined}
      // Geometry is the design's and is identical in both states — only the
      // tint, border and glyph colour change, so the row never shifts when it
      // becomes current. 46px tall, 199px wide once the rail is labelled;
      // below xl it collapses to the icon rail and sizes to its glyph.
      className={cn(
        "group relative box-border flex h-[46px] items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors",
        active
          ? // The tint, border and glyph are all one purple: --color-create.
            // The design measured #AD46FF here, a third purple the system does
            // not have — see the note in CLAUDE.md for why this renders from
            // the existing token instead.
            "border border-create/30 bg-create/[0.11] text-white shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
          : "border border-transparent text-body hover:bg-white/[0.06]"
      )}
    >
      <span className={cn("relative shrink-0", active ? "text-create" : "text-grey-400")}>
        <Icon className="h-6 w-6" filled={active} />
        {badge > 0 && (
          <span className="tnum absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-spotlight px-1 text-[9px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      {/* Roboto in the measurement, Geist here per CLAUDE.md — the weight,
          size and line-height are the design's. */}
      <span
        className={cn(
          "hidden min-w-0 flex-col truncate text-[12px] font-bold leading-4 group-data-[rail=full]/rail:flex",
          active ? "text-white" : "text-body"
        )}
      >
        {item.label}
      </span>
      {/* Icon-rail tooltip: the only place the label lives while collapsed. */}
      <span className="ws-overlay pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-body group-hover:block group-data-[rail=full]/rail:!hidden">
        {item.label}
      </span>
    </Link>
  );
}

// Which nav hrefs wear a badge, and which global count feeds each.
const BADGE_FOR: Record<
  string,
  ((counts: { messages: number; notifications: number } | undefined) => number) | undefined
> = {
  "/notifications": (counts) => counts?.notifications ?? 0,
  "/messages": (counts) => counts?.messages ?? 0,
};

/**
 * The icon rail's overflow.
 *
 * It used to open on hover and `focus-within` only, so a tap opened nothing
 * and closed nothing. The trigger owns the state now, which also makes it
 * reachable from the keyboard.
 */
function MoreMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="relative group-data-[rail=full]/rail:hidden">
      <button
        aria-label="More"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="ws-nav flex w-full items-center gap-4 p-3 text-body"
      >
        <IconMore className="h-6 w-6 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="ws-glass absolute bottom-0 left-full z-50 ml-2 w-52 rounded-2xl p-1.5">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/10",
                  isActive(pathname, item.href) ? "text-heading" : "text-body"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Bottom-of-rail account chip: avatar, identity, overflow dots (X pattern). */
function AccountChip() {
  const { ready, authenticated, login } = useAuth();
  const logout = useLogout();
  const me = useMe();

  if (!ready) return <div className="ws-skeleton mx-2 h-12 rounded-full" />;

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="ws-press flex h-12 w-12 items-center justify-center gap-2 self-center rounded-full bg-accent font-bold text-ink group-data-[rail=full]/rail:h-auto group-data-[rail=full]/rail:w-full group-data-[rail=full]/rail:p-3 group-data-[rail=full]/rail:px-6"
        aria-label="Sign in"
      >
        <IconUser className="h-5 w-5 group-data-[rail=full]/rail:hidden" />
        <span className="hidden group-data-[rail=full]/rail:block">Sign in</span>
      </button>
    );
  }

  // Pinned to the foot of the rail as a bordered 12px-radius card, sat under
  // its own hairline — the design's account block, not a bare row.
  return (
    <div className="group relative">
      <Link
        href={me.data ? `/u/${me.data.username}` : "/auth"}
        className="flex w-full items-center gap-[11px] rounded-xl border border-white/10 bg-white/[0.03] p-2 transition-colors hover:bg-white/8"
      >
        <Avatar name={me.data?.displayName ?? "Me"} seed={me.data?.id} src={me.data?.avatarUrl} size={34} />
        <span className="hidden min-w-0 flex-1 group-data-[rail=full]/rail:block">
          <span className="block truncate text-[12px] font-bold leading-4 text-white">
            {me.data?.displayName ?? "You"}
          </span>
          <span className="block truncate text-[10px] leading-[15px] text-white/40">
            @{me.data?.username ?? "…"}
          </span>
        </span>
        <IconDots className="hidden h-4 w-4 shrink-0 text-meta group-data-[rail=full]/rail:block" />
      </Link>
      <div className="ws-glass absolute bottom-full left-0 z-50 mb-2 hidden w-56 rounded-2xl p-1.5 group-focus-within:block group-hover:block">
        <Link
          href={me.data ? `/u/${me.data.username}` : "/auth"}
          className="block rounded-xl px-3 py-2.5 text-sm text-body transition-colors hover:bg-white/10"
        >
          View profile
        </Link>
        <button
          onClick={() => void logout()}
          className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-body transition-colors hover:bg-white/10"
        >
          Log out @{me.data?.username ?? ""}
        </button>
      </div>
    </div>
  );
}


/**
 * The drag edge between the nav and the page.
 *
 * A `separator` with `tabIndex` rather than a bare div: resizing is a real
 * control, and a control that only answers a mouse drag does not exist for
 * anyone navigating by keyboard. Arrows resize, Enter collapses, and the
 * double-click shortcut matches every other resizable pane.
 */
function RailHandle({
  rail,
  preview,
  commit,
}: {
  rail: RailState;
  preview: (next: RailState) => void;
  commit: (next: RailState) => void;
}) {
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // The rail at the START of the drag: `railFromDrag` reads the remembered
    // labelled width from it, which must not move while the pointer does.
    const start = rail;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();

    const move = (moved: PointerEvent) => preview(railFromDrag(moved.clientX, start));
    const up = (ended: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      commit(railFromDrag(ended.clientX, start));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={railWidth(rail)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={() => commit(toggleRail(rail))}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") commit(railFromDrag(railWidth(rail) - 16, rail));
        else if (event.key === "ArrowRight") commit(railFromDrag(railWidth(rail) + 16, rail));
        else if (event.key === "Enter" || event.key === " ") commit(toggleRail(rail));
        else return;
        event.preventDefault();
      }}
      // Inside the rail, not straddling its edge: the aside clips its own
      // overflow, and a handle hanging past that edge is invisible to hit
      // testing exactly where it looks grabbable.
      className="group/handle absolute inset-y-0 right-0 z-50 hidden w-2.5 cursor-col-resize md:block"
    >
      <span className="absolute inset-y-0 right-0 w-[3px] rounded-full bg-transparent transition-colors group-hover/handle:bg-create/50 group-focus-visible/handle:bg-create" />
    </div>
  );
}

function Sidebar({
  pathname,
  onCompose,
}: {
  pathname: string;
  /** Absent on surfaces that suppress composing — see allowsCompose. */
  onCompose?: () => void;
}) {
  const { authenticated } = useAuth();
  const me = useMe();
  const broadcast = useBroadcastStatus();
  // Both badges come from one global endpoint, never from a loaded page.
  const unread = useUnread();

  const { rail, preview, commit } = useRailState();

  const visible = visibleNav({
    authenticated,
    isAdmin: Boolean(me.data?.isAdmin),
    isOperator: me.data?.role === "worldstreet",
  });

  return (
    // Scrolls when it does not fit. It is h-dvh with no overflow handling, so
    // on a short laptop screen everything below the fold — Go live, the
    // account chip, View profile — was simply unreachable: clipped, with no
    // way to scroll to it. The scrollbar is hidden because a rail that shows
    // one looks broken next to the timeline's.
    //
    // `data-rail` is what every label, glyph and pad inside reads to know
    // which state it is in. It replaced a wall of `xl:` variants: a breakpoint
    // decides the rail from the WINDOW, which is a guess about the reader —
    // the same 1280px laptop can want the labels or want the room.
    <aside
      data-rail={rail.mode}
      style={{ width: railWidth(rail) }}
      className="group/rail ws-hair sticky top-0 z-40 hidden h-dvh shrink-0 flex-col items-center overflow-hidden border-r bg-[#0f0f0f] px-3 py-5 md:flex data-[rail=full]:items-stretch"
    >
      <RailHandle rail={rail} preview={preview} commit={commit} />
      {/* The wordmark lockup sits over its own hairline. */}
      <Link
        href="/"
        aria-label="Market Square home"
        title="Market Square"
        className="ws-press mb-4 flex shrink-0 items-center justify-center border-b border-white/10 pb-4 group-data-[rail=full]/rail:justify-start group-data-[rail=full]/rail:px-2.5"
      >
        {/* The icon rail wears the mark alone; the expanded sidebar wears the
            full lockup. Heights are set so the TYPE inside the lockup reads at
            roughly the size the old type-only wordmark did — the lockup is
            ~3.3:1 where that asset was ~12.8:1, so matching the old height
            would have shrunk the type to about 9px. */}
        <LogoMark size={28} className="group-data-[rail=full]/rail:hidden" />
        <Wordmark height={30} className="hidden group-data-[rail=full]/rail:block" />
      </Link>

      {/* The explicit control. The drag edge is discoverable only once you
          know it is there; this says the rail collapses. */}
      <button
        onClick={() => commit(toggleRail(rail))}
        aria-label={rail.mode === "icon" ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={rail.mode === "full"}
        className="ws-press mb-2 flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg text-meta transition-colors hover:bg-white/[0.06] hover:text-body group-data-[rail=full]/rail:justify-end group-data-[rail=full]/rail:px-2"
      >
        <IconChevronLeft
          className={cn("h-4 w-4 transition-transform", rail.mode === "icon" && "rotate-180")}
        />
      </button>

      {/* The ONLY scrolling region. The whole rail used to scroll, which put
          the account chip, Go live and Post on a conveyor belt: on a short
          laptop screen the identity you are posting as slid off the bottom
          with the nav. The chrome is pinned and the list of places moves
          inside it — the shape every desktop app with a rail uses.
          `min-h-0` because a flex child's default minimum is its CONTENT, so
          without it the nav refuses to shrink and pushes the footer off the
          bottom instead of scrolling. */}
      <nav
        className="flex w-full min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Primary"
      >
        {visible
          .filter((item) => !item.secondary)
          .map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              badge={BADGE_FOR[item.href]?.(unread.data) ?? 0}
            />
          ))}
        {/* Expanded rail shows everything; the icon rail folds the rest away. */}
        <div className="hidden flex-col gap-1 group-data-[rail=full]/rail:flex">
          {visible
            .filter((item) => item.secondary)
            .map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
        </div>
        <MoreMenu items={visible.filter((item) => item.secondary)} pathname={pathname} />
      </nav>

      {/* Post is the primary act; going live is the one Market Square adds
          next to it, so it sits directly underneath as the quiet twin.
          It opens the composer in place — it used to link to `/?compose=1`,
          which meant reaching for Post from anywhere threw the reader back to
          home and lost their place. */}
      <div className="mt-4 flex shrink-0 flex-col items-center gap-2 group-data-[rail=full]/rail:items-stretch group-data-[rail=full]/rail:px-1">
        {authenticated && onCompose && (
          <button
            onClick={onCompose}
            // Square while the rail is icons — the button has no label to give it
            // width there, so a full-height pill came out 22px wide and read as
            // a squashed sliver. It takes the rail's full width once labelled.
            className="ws-press flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-accent font-bold text-ink transition-colors hover:bg-white group-data-[rail=full]/rail:h-13 group-data-[rail=full]/rail:w-full group-data-[rail=full]/rail:text-[17px]"
            aria-label="Post gist"
          >
            <IconPlus className="h-6 w-6 group-data-[rail=full]/rail:hidden" />
            <span className="hidden group-data-[rail=full]/rail:block">Post gist</span>
          </button>
        )}
        <Link
          href="/studio"
          className="ws-press flex h-12 w-12 items-center justify-center gap-2 rounded-full border border-white/20 font-bold text-body transition-colors hover:bg-white/8 group-data-[rail=full]/rail:h-13 group-data-[rail=full]/rail:w-full"
          aria-label="Go live"
        >
          <IconCamera className="h-5 w-5" />
          <span className="hidden group-data-[rail=full]/rail:block">Go live</span>
        </Link>
      </div>

      <div className="mt-4 w-full shrink-0 border-t border-white/10 pt-4">
        {broadcast.live && (
          <div className="mb-2 flex justify-center group-data-[rail=full]/rail:justify-start group-data-[rail=full]/rail:pl-2">
            <OnAirPill streamId={broadcast.streamId} compact />
          </div>
        )}
        <AccountChip />
      </div>
    </aside>
  );
}

// The breadcrumb strip above the columns. Only the leaf changes — the root is
// always the ecosystem the square belongs to.
const CRUMB: Array<[RegExp, string]> = [
  [/^\/$/, "Market Square"],
  [/^\/discover/, "Discover"],
  [/^\/arkmarks/, "Arkmarks"],
  [/^\/messages/, "Messages"],
  [/^\/notifications/, "Notifications"],
  [/^\/live\b/, "Live"],
  [/^\/tickets/, "Tickets"],
  [/^\/store/, "ARK Store"],
  [/^\/schedule/, "Schedule"],
  [/^\/studio/, "Studio"],
  [/^\/admin/, "Admin"],
  [/^\/operations/, "Operations"],
  [/^\/spotlight/, "Citizen Spotlight"],
  [/^\/p\//, "Post"],
  [/^\/u\//, "Profile"],
  [/^\/auth/, "Sign in"],
];

function Breadcrumb({ pathname }: { pathname: string }) {
  const leaf = CRUMB.find(([pattern]) => pattern.test(pathname))?.[1] ?? "Market Square";
  return (
    <div className="ws-hair hidden h-[69px] shrink-0 items-center border-b bg-[#0f0f0f] px-6 md:flex">
      <nav aria-label="Breadcrumb" className="text-[16px] text-[#979797]">
        <Link href="/" className="hover:text-body">
          Ark Ecosystem
        </Link>
        <span aria-hidden>/ </span>
        <span aria-current="page">{leaf}</span>
      </nav>
    </div>
  );
}

/**
 * Everything the sidebar offers, on a phone.
 *
 * The bottom bar holds four tabs; the sidebar's "More" menu and the account
 * dropdown are both `md:` only. That left Tickets, Store, Live, Studio,
 * Schedule, Admin, Operations — and Log out — with NO mobile entry point at
 * all: about half the app was unreachable without a desktop browser. This
 * drawer is that entry point, listing the same items the sidebar does under
 * the same visibility rules.
 */
function MobileMenu({
  open,
  onClose,
  items,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  pathname: string;
}) {
  const { ready, authenticated, login } = useAuth();
  const me = useMe();
  const logout = useLogout();

  // A route change means the drawer did its job.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close on navigation only
  }, [pathname]);

  return (
    <Sheet open={open} onClose={onClose} title="Menu">
      <div className="space-y-4">
        {ready && !authenticated ? (
          <button
            onClick={() => {
              onClose();
              login();
            }}
            className="ws-press flex w-full items-center justify-center rounded-full bg-accent px-6 py-3 font-bold text-ink"
          >
            Sign in
          </button>
        ) : (
          <Link
            href={me.data ? `/u/${me.data.username}` : "/auth"}
            onClick={onClose}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/8"
          >
            <Avatar name={me.data?.displayName ?? "Me"} seed={me.data?.id} src={me.data?.avatarUrl} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-heading">
                {me.data?.displayName ?? "You"}
              </span>
              <span className="block truncate text-xs text-meta">@{me.data?.username ?? "…"}</span>
            </span>
            <span className="shrink-0 text-xs text-meta">View profile</span>
          </Link>
        )}

        <nav aria-label="All sections" className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              onClick={onClose}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors",
                isActive(pathname, item.href)
                  ? "border-white/15 bg-white/10 text-heading"
                  : "border-white/10 text-body hover:bg-white/[0.06]"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>

        {authenticated && (
          <Link
            href="/studio"
            onClick={onClose}
            className="ws-press flex w-full items-center justify-center gap-2 rounded-full border border-white/20 py-3 font-bold text-body transition-colors hover:bg-white/8"
          >
            <IconCamera className="h-5 w-5" /> Go live
          </Link>
        )}

        {authenticated && (
          <button
            onClick={() => {
              onClose();
              void logout();
            }}
            className="w-full rounded-full border border-white/10 py-3 text-sm font-semibold text-body transition-colors hover:bg-white/8"
          >
            Log out{me.data?.username ? ` @${me.data.username}` : ""}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function MobileBar({ pathname }: { pathname: string }) {
  const { authenticated } = useAuth();
  const me = useMe();
  const [menuOpen, setMenuOpen] = useState(false);

  // Four tabs plus the drawer. Everything else the sidebar lists lives behind
  // that fifth slot rather than being unreachable.
  const visible = visibleNav({
    authenticated,
    isAdmin: Boolean(me.data?.isAdmin),
    isOperator: me.data?.role === "worldstreet",
  });
  const tabs = visible.filter((item) => !item.secondary && item.href !== "/studio").slice(0, 4);

  return (
    <nav
      className="ws-head fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-b-0 border-t md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      {tabs.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          // The mobile frame labels every tab under a 24px glyph and dims the
          // inactive ones to #6D6D6D.
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "ws-press flex flex-1 flex-col items-center gap-2.5 py-2.5",
              active ? "text-[#E6E6E6]" : "text-[#6D6D6D]"
            )}
          >
            <item.icon className="h-6 w-6" filled={active} />
            <span className={cn("text-[12px] leading-[14.8px]", active && "text-white")}>
              {item.label}
            </span>
          </Link>
        );
      })}
      <button
        onClick={() => setMenuOpen(true)}
        aria-label="More sections"
        aria-expanded={menuOpen}
        className="ws-press flex flex-1 flex-col items-center gap-2.5 py-2.5 text-[#6D6D6D]"
      >
        <IconMore className="h-6 w-6" />
        <span className="text-[12px] leading-[14.8px]">More</span>
      </button>
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={visible}
        pathname={pathname}
      />
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useTrackNavHistory();
  const { authenticated } = useAuth();
  const broadcast = useBroadcastStatus();
  const [composeOpen, setComposeOpen] = useState(false);

  // One piece of local state drives every compose entry point in the shell —
  // sidebar Post, the desktop floating button and the mobile one. They all sit
  // inside this component, so a prop is enough; no context store required.
  const canCompose = authenticated && allowsCompose(pathname);

  // The stream room owns its whole viewport; the shell stays out of the way
  // there (no rails over the player, no bars).
  const inRoom = /^\/live\/[^/]+$/.test(pathname);
  const wide = isWide(pathname);

  if (inRoom) {
    return (
      <>
        <main className="min-h-dvh">{children}</main>
        <ClaimUsernameGate />
      </>
    );
  }

  return (
    // Full width. The shell used to cap at 1600px, so a wider monitor drew the
    // whole product in a 1600px band with the slack parked at the right edge —
    // the app looked left-aligned on the screens with the most room to give.
    // The cap is gone and the timeline takes the extra width from xl up.
    <div className="flex w-full">
      <Sidebar pathname={pathname} onCompose={canCompose ? () => setComposeOpen(true) : undefined} />

      {/* Mobile top strip: wordmark plus the two things worth reaching from
          anywhere — what's live, and search. */}
      <div className="ws-head fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between px-4 md:hidden">
        <Wordmark height={26} />
        <div className="flex items-center gap-3">
          {broadcast.live && <OnAirPill streamId={broadcast.streamId} compact />}
          <Link href="/discover" className="text-meta" aria-label="Explore">
            <IconSearch className="h-5 w-5" />
          </Link>
          {authenticated && (
            <Link href="/notifications" className="text-meta" aria-label="Notifications">
              <IconBell className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>

      {/* The breadcrumb spans the column and the rail together, so both live
          inside one flex-column beside the sidebar. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Breadcrumb pathname={pathname} />
        {/* justify-START, not center. Centering the column+rail group inside
            the leftover width of the 1600px shell split that slack in two and
            left a dead band between the sidebar and the column — the column
            read as floating away from the nav that selects it. Packed left,
            the column sits against the sidebar and the slack collects once, at
            the outer edge, where the shell's own mx-auto already balances it. */}
        <div className="flex min-w-0 flex-1 justify-start">
          <main
            className={cn(
              // Padding, not margin, and from the shared chrome vars rather
              // than hand-matched numbers: pb-16 was 64px against a 69px tab
              // bar, so the last five pixels of every column surface sat
              // underneath it.
              // overflow-x-clip is a BACKSTOP, not the fix: a single child with
              // an intrinsic minimum wider than a phone (a fixed-width CTA, a
              // row of shrink-0 groups) drags the whole page sideways, and the
              // reader then has to scroll horizontally to reach the right edge
              // of every other surface. Clip contains that blast radius to the
              // offending row. Rails that are MEANT to scroll set their own
              // overflow-x-auto and are unaffected, and anything that needs a
              // horizontal scrollbar must still opt into one explicitly.
              //
              // No max-width. The column had one (720px on home, 600px
              // elsewhere) and the shell had another (1600px), so the layout
              // stopped growing while the window kept going — 125px of dead
              // black at 1440, 197px at 1512, 445px at 1920, always parked on
              // the right, where it reads as the whole product shoved to one
              // side. Every pane flexes to the window it is in instead.
              "ws-hair min-h-dvh min-w-0 flex-1 overflow-x-clip border-x pt-[var(--ws-topbar-h)] pb-[var(--ws-nav-h)]"
            )}
          >
            {children}
          </main>

          {!wide && <RightRail />}
        </div>
      </div>

      {/* Mobile compose: a floating silver core, the one elevated control.
          It opens the composer where you stand — it used to link to
          `/?compose=1`, so posting from `/store` meant losing the page you
          were on. The offset clears the bottom tab bar plus the home
          indicator. The design's mobile frames do not draw a compose button at
          all, so this placement is ours, not the file's. */}

      {/* The one create button. Fixed, mounted here rather than in any route,
          so it holds the same viewport corner on every surface. */}
      {canCompose && <CreateFab onClick={() => setComposeOpen(true)} />}

      <ComposeSheet open={composeOpen} onClose={() => setComposeOpen(false)} />

      <MobileBar pathname={pathname} />

      {/* First-load claim-username prompt for freshly created profiles. */}
      <ClaimUsernameGate />
      {/* Session-expiry watchdog: logs out properly instead of half-stuck. */}
      <SessionGuard />
    </div>
  );
}
