"use client";

import { createPortal } from "react-dom";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useTrackNavHistory } from "@/lib/nav-history";
import {
  type RailState,
  railFromDrag,
  railWidth,
  toggleRail,
} from "@/lib/sidebar-rail";
import { useRailState } from "@/lib/sidebar-rail-store";
import { allowsCompose } from "@/lib/compose-surfaces";
import { MARKET_FLAGS } from "@/lib/market-config";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { useLogout } from "@/hooks/use-logout";
import { useBroadcastStatus } from "@/hooks/use-broadcast-status";
import { ClaimUsernameGate } from "@/features/profile";
import { InterestGate } from "@/features/discovery";
import { useUnread } from "@/hooks/use-unread";
import { SessionGuard } from "@/components/layout/session-guard";
import { Avatar } from "@/components/ui/avatar";
import { LogoMark, Wordmark } from "@/components/ui/wordmark";
import { RightRail } from "@/components/layout/right-rail";
import { CreateFab } from "@/components/layout/create-fab";
import { ComposeSheet } from "@/components/layout/compose-sheet";
import { TickerSheet } from "@/components/layout/ticker-sheet";
import { ConnectionBanner } from "@/components/layout/connection-banner";
import { Sheet } from "@/components/ui/sheet";
import {
  IconBell,
  IconBookmark,
  IconCalendar,
  IconChevronLeft,
  IconCamera,
  IconDots,
  IconHome,
  IconHouses,
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

// One ordered list drives the sidebar at every breakpoint. Primary items are
// always visible; secondary ones collapse into More on shorter rails.
//
/*
  FOUR primary rows, and everything else behind More.

  The rail used to list every surface the app has, which turned the first
  thing a reader sees into a directory. 2.0 does three things — talk in a
  room, meet somebody, keep up with your people — and the rail now says so.

  What moved is not gone: `secondary` folds an entry into More, so Tickets,
  Studio, Arkmarks, Schedule, Spotlight and Store keep their routes, their
  deep links and their behaviour. They stop costing a permanent slot for
  something opened once a week.

  Live went secondary rather than away. With video leaving Market Square, Live
  and Houses are two names for "a room happening now", and two names is how a
  reader learns to guess which one they want. Houses is not in the rail at all
  any more: the hallway is the top of Home, and a nav row pointing at the same
  rooms would be a second door to the room you are already looking at.

  Spotlight has a nav entry because the right rail, which used to be its only
  door, is `hidden lg:block` — so below lg there was no way to reach it at
  all. The "second door to the same room" argument only holds where the first
  door exists, and on a phone it does not.
*/
const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/discover", label: "Explore", icon: IconSearch },
  { href: "/messages", label: "Messages", icon: IconMail, authed: true },
  {
    href: "/notifications",
    label: "Notifications",
    icon: IconBell,
    authed: true,
  },
  { href: "/live", label: "Live", icon: IconLive, secondary: true },
  // Houses has no rail entry: the hallway is the top of Home, and "See all"
  // there is the door to /houses. `/houses/[id]` always resolves whatever the
  // flag says — a link somebody was sent has to work, and hiding an entry
  // must never break a route.
  { href: "/tickets", label: "Tickets", icon: IconTicket, authed: true, secondary: true },
  // Arkmarks had a route and a save button on every post, and no way in: the
  // only path to something you saved was typing the URL.
  {
    href: "/arkmarks",
    label: "Arkmarks",
    icon: IconBookmark,
    authed: true,
    secondary: true,
  },
  { href: "/spotlight", label: "Spotlight", icon: IconSpark, secondary: true },
  // Reachable by URL, by deep link and from Explore's Products tab — just
  // not promoted in the nav while `storeNav` is off.
  { href: "/store", label: "Store", icon: IconStore, flag: "storeNav" },
  {
    href: "/schedule",
    label: "Schedule",
    icon: IconCalendar,
    authed: true,
    secondary: true,
  },
  { href: "/studio", label: "Studio", icon: IconCamera, authed: true, secondary: true },
  {
    href: "/admin",
    label: "Admin",
    icon: IconShield,
    authed: true,
    admin: true,
    secondary: true,
  },
  {
    href: "/operations",
    label: "Operations",
    icon: IconShield,
    authed: true,
    operator: true,
    secondary: true,
  },
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
      (!item.flag || MARKET_FLAGS[item.flag]),
  );
}

// Messages is two panes side by side — the conversation list and the thread
// it opens — so it needs the width a right rail would take. On a phone the
// panes swap instead, which is why only the exact path is wide.
const WIDE_EXACT = ["/store", "/operations", "/messages"];
const WIDE_PREFIX = ["/store/", "/operations/", "/studio/"];

function isWide(pathname: string): boolean {
  return (
    WIDE_EXACT.includes(pathname) ||
    WIDE_PREFIX.some((prefix) => pathname.startsWith(prefix))
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

function OnAirPill({
  streamId,
  compact,
}: {
  streamId: string | null;
  compact?: boolean;
}) {
  return (
    <Link
      href="/studio"
      aria-label="You're live — back to the studio"
      title="You're live — back to the studio"
      className={cn(
        "ws-press flex items-center gap-1.5 rounded-full bg-accent font-bold uppercase tracking-wider text-ink",
        compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]",
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
      {...(item.external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
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
          : "border border-transparent text-body hover:bg-white/[0.06]",
      )}
    >
      <span
        className={cn(
          "relative shrink-0",
          active ? "text-create" : "text-grey-400",
        )}
      >
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
          active ? "text-white" : "text-body",
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
  | ((
      counts: { messages: number; notifications: number } | undefined,
    ) => number)
  | undefined
> = {
  "/notifications": (counts) => counts?.notifications ?? 0,
  "/messages": (counts) => counts?.messages ?? 0,
};

/**
 * A rail menu that can actually leave the rail.
 *
 * The sidebar is `overflow-hidden` — it has to be, because it resizes by drag
 * and labels would spill at every intermediate width — so an `absolute` panel
 * inside it is CLIPPED at the rail's edge. In the collapsed 72px rail that
 * sliced a 208px menu down to a stub: "View p…", "Log ou…". Nothing about the
 * panel's own classes could fix it; the clip belongs to an ancestor.
 *
 * So the panel is portalled to the body and positioned `fixed` from the
 * trigger's rect — the same escape `symbol-picker` already makes. It is
 * re-measured on open, scroll and resize, and clamped into the viewport so a
 * short window cannot push it off the top.
 */
function RailMenu({
  label,
  trigger,
  children,
  align = "right",
}: {
  label: string;
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  /** "right" clears the collapsed rail; "above" stacks over the account chip. */
  align?: "right" | "above";
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const node = anchor.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const width = 224;
      const left =
        align === "right"
          ? Math.min(rect.right + 8, window.innerWidth - width - 8)
          : Math.min(rect.left, window.innerWidth - width - 8);
      // 8px of breathing room at the top, so a short viewport clamps rather
      // than opening a menu whose first item is off-screen.
      const top = Math.max(8, rect.top - 8);
      setAt({ left: Math.max(8, left), top });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, align]);

  return (
    <div ref={anchor} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open &&
        at &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
            <div
              role="menu"
              aria-label={label}
              style={{
                left: at.left,
                // Bottom-anchored: the menu grows upward from the trigger,
                // which is what both rail menus want — they live at the foot.
                bottom: Math.max(8, window.innerHeight - at.top),
                width: 224,
              }}
              className="ws-popover fixed z-[61] rounded-2xl p-1.5"
            >
              {children(() => setOpen(false))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

/**
 * The icon rail's overflow.
 *
 * It used to open on hover and `focus-within` only, so a tap opened nothing
 * and closed nothing. The trigger owns the state now, which also makes it
 * reachable from the keyboard.
 */
function MoreMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  if (items.length === 0) return null;
  return (
    <div className="group-data-[rail=full]/rail:hidden">
      <RailMenu
        label="More"
        align="right"
        trigger={({ open, toggle }) => (
          <button
            aria-label="More"
            aria-expanded={open}
            onClick={toggle}
            className="ws-nav flex w-full items-center gap-4 p-3 text-body"
          >
            <IconMore className="h-6 w-6 shrink-0" />
          </button>
        )}
      >
        {(close) =>
          items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              {...(item.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              onClick={close}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/10",
                isActive(pathname, item.href) ? "text-heading" : "text-body",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))
        }
      </RailMenu>
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
        <span className="hidden group-data-[rail=full]/rail:block">
          Sign in
        </span>
      </button>
    );
  }

  // Pinned to the foot of the rail as a bordered 12px-radius card, sat under
  // its own hairline — the design's account block, not a bare row.
  // The chip is a BUTTON, not a link with a hover menu. It was
  // `group-hover:block group-focus-within:block`, which is the same defect
  // MoreMenu was fixed for one screen earlier: on a touch device a tap follows
  // the link and the menu never opens, so "View profile" and "Log out" did not
  // exist on a tablet at all. Opening it on click gives both entries a target
  // and keeps the profile reachable as the menu's first item.
  return (
    <RailMenu
      label="Account"
      align="above"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={`Account menu for @${me.data?.username ?? "you"}`}
          className="flex w-full items-center gap-[11px] rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left transition-colors hover:bg-white/8"
        >
          <Avatar
            name={me.data?.displayName ?? "Me"}
            seed={me.data?.id}
            src={me.data?.avatarUrl}
            size={34}
          />
          <span className="hidden min-w-0 flex-1 group-data-[rail=full]/rail:block">
            <span className="block truncate text-[12px] font-bold leading-4 text-white">
              {me.data?.displayName ?? "You"}
            </span>
            <span className="block truncate text-[10px] leading-[15px] text-white/40">
              @{me.data?.username ?? "…"}
            </span>
          </span>
          <IconDots className="hidden h-4 w-4 shrink-0 text-meta group-data-[rail=full]/rail:block" />
        </button>
      )}
    >
      {(close) => (
        <>
          <Link
            href={me.data ? `/u/${me.data.username}` : "/auth"}
            onClick={close}
            className="block rounded-xl px-3 py-2.5 text-sm text-body transition-colors hover:bg-white/10"
          >
            View profile
          </Link>
          <button
            onClick={() => {
              close();
              void logout();
            }}
            className="block w-full truncate rounded-xl px-3 py-2.5 text-left text-sm text-body transition-colors hover:bg-white/10"
          >
            Log out @{me.data?.username ?? ""}
          </button>
        </>
      )}
    </RailMenu>
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

    const move = (moved: PointerEvent) =>
      preview(railFromDrag(moved.clientX, start));
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
        if (event.key === "ArrowLeft")
          commit(railFromDrag(railWidth(rail) - 16, rail));
        else if (event.key === "ArrowRight")
          commit(railFromDrag(railWidth(rail) + 16, rail));
        else if (event.key === "Enter" || event.key === " ")
          commit(toggleRail(rail));
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
        <Wordmark
          height={30}
          className="hidden group-data-[rail=full]/rail:block"
        />
      </Link>

      {/* The explicit control. The drag edge is discoverable only once you
          know it is there; this says the rail collapses. */}
      <button
        onClick={() => commit(toggleRail(rail))}
        aria-label={
          rail.mode === "icon" ? "Expand sidebar" : "Collapse sidebar"
        }
        aria-expanded={rail.mode === "full"}
        className="ws-press mb-2 flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg text-meta transition-colors hover:bg-white/[0.06] hover:text-body group-data-[rail=full]/rail:justify-end group-data-[rail=full]/rail:px-2"
      >
        <IconChevronLeft
          className={cn(
            "h-4 w-4 transition-transform",
            rail.mode === "icon" && "rotate-180",
          )}
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
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
              />
            ))}
        </div>
        <MoreMenu
          items={visible.filter((item) => item.secondary)}
          pathname={pathname}
        />
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
            <span className="hidden group-data-[rail=full]/rail:block">
              Post gist
            </span>
          </button>
        )}
        <Link
          href="/studio"
          className="ws-press flex h-12 w-12 items-center justify-center gap-2 rounded-full border border-white/20 font-bold text-body transition-colors hover:bg-white/8 group-data-[rail=full]/rail:h-13 group-data-[rail=full]/rail:w-full"
          aria-label="Go live"
        >
          <IconCamera className="h-5 w-5" />
          <span className="hidden group-data-[rail=full]/rail:block">
            Go live
          </span>
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
  const leaf =
    CRUMB.find(([pattern]) => pattern.test(pathname))?.[1] ?? "Market Square";
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
            <Avatar
              name={me.data?.displayName ?? "Me"}
              seed={me.data?.id}
              src={me.data?.avatarUrl}
              size={40}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-heading">
                {me.data?.displayName ?? "You"}
              </span>
              <span className="block truncate text-xs text-meta">
                @{me.data?.username ?? "…"}
              </span>
            </span>
            <span className="shrink-0 text-xs text-meta">View profile</span>
          </Link>
        )}

        <nav aria-label="All sections" className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              {...(item.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              onClick={onClose}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors",
                isActive(pathname, item.href)
                  ? "border-white/15 bg-white/10 text-heading"
                  : "border-white/10 text-body hover:bg-white/[0.06]",
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

function MobileBar({
  pathname,
  items,
  unread,
  onCompose,
}: {
  pathname: string;
  items: NavItem[];
  unread: { messages: number; notifications: number } | undefined;
  /** Absent where composing is suppressed — the bar then has no centre node. */
  onCompose?: () => void;
}) {
  // Four tabs, and only four. Everything else the sidebar lists lives in the
  // drawer behind the account avatar in the top strip — this bar used to carry
  // a fifth "More" slot for the same drawer, which meant two doors to one room
  // and one of them wearing a glyph that names nothing.
  const tabs = items
    .filter((item) => !item.secondary && item.href !== "/studio")
    .slice(0, 4);

  return (
    /**
     * A floating pill, not a full-width band.
     *
     * The band was a rectangle welded to the bottom edge carrying five stacked
     * icon-and-label columns, which is a 2016 tab bar: it spends ~70px of a
     * phone screen on labels for destinations the reader already knows, and it
     * makes the compose button an intruder that has to float ON TOP of it.
     *
     * This is the shape the rest of the platform uses (`wsws-frontend`'s
     * `MobileTabBar`) — a glass pill above the safe area, tabs reduced to their
     * glyph, and only the CURRENT one wearing its name. One label instead of
     * five says where you are more clearly than five did, and the space it
     * saves is what lets the compose button sit BESIDE the bar rather than over
     * it.
     *
     * `pointer-events-none` on the frame, `auto` on the bar: the frame spans
     * the screen so the bar can be centred in it, and without that the strip of
     * empty space either side would swallow taps meant for the feed.
     */
    <div
      // The bar is centred on the SCREEN and the create button is taken out of
      // the flow entirely, pinned to the right edge.
      //
      // Both alternatives put the bar off centre. Centred as a PAIR it drifted
      // left by half the button, so navigation moved depending on whether the
      // reader was allowed to post at all. As a three-column grid it drifted
      // the other way once the middle column ran out of room — 3px at 360px,
      // small but exactly the kind of thing that reads as sloppy. Absolute
      // positioning is the only arrangement where the centre is the centre at
      // every width.
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-center justify-center px-3 md:hidden",
        // The bar centres in the space it ACTUALLY has, not on the screen.
        //
        // Centred on the screen, the pill grows symmetrically as the active
        // tab's label appears — and "Messages" is wide enough that its right
        // edge reached the create button and touched it. Nudging the bar left
        // by a fixed amount would fix the collision and break the centring the
        // moment a shorter label was active.
        //
        // Reserving the button's own footprint (58px + its 12px inset) makes
        // the collision structurally impossible at any label length, and the
        // bar stays optically centred in the row that remains. With no create
        // button there is nothing to reserve, so it centres on the screen
        // exactly as before.
        onCompose && "pr-[70px]",
      )}
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <nav
        aria-label="Primary"
        className="ws-glass pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-white/12 p-1.5 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)]"
      >
        {tabs.map((item) => {
          const active = isActive(pathname, item.href);
          const badge = BADGE_FOR[item.href]?.(unread) ?? 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={
                badge > 0 ? `${item.label}, ${badge} unread` : item.label
              }
              className={cn(
                "ws-press flex h-11 items-center gap-1.5 rounded-full transition-colors",
                active
                  ? "bg-white/[0.14] px-3.5 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
                  : "w-11 justify-center text-white/50",
              )}
            >
              <span className="relative shrink-0">
                <item.icon className="h-[21px] w-[21px]" filled={active} />
                {/* The count lives HERE and only here. It used to sit on a
                    second bell in the top strip, which was the same
                    destination without the number. */}
                {badge > 0 && (
                  <span className="tnum absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-spotlight px-1 text-[9px] font-bold text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              {active && (
                <span className="whitespace-nowrap text-[12.5px] font-medium">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Pinned to the right edge and OUT of the flow, so it cannot move the
          bar. It used to be a fixed circle in the corner that landed on top of
          the tab bar and the composer's own controls; sharing this row means
          neither covers the other, and being absolute means the bar's centre
          does not depend on whether this button is there. */}
      {onCompose && (
        <button
          onClick={onCompose}
          aria-label="Create post"
          // Exactly the bar's outer height (44px row + 6px padding + 1px
          // border, twice), so the two read as one row of controls rather than
          // a bar with something smaller stuck beside it.
          className="ws-btn-fab ws-press pointer-events-auto absolute right-3 grid size-[58px] shrink-0 place-items-center rounded-full text-white shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)]"
        >
          <IconPlus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useTrackNavHistory();
  const { authenticated } = useAuth();
  const me = useMe();
  const unread = useUnread();
  const broadcast = useBroadcastStatus();
  const [composeOpen, setComposeOpen] = useState(false);
  /**
   * The mobile drawer, owned HERE because two surfaces open it: the account
   * avatar in the top strip and the "More" tab at the bottom. Two copies of
   * the state would mean two drawers, and the second one to open would sit
   * over the first.
   */
  const [menuOpen, setMenuOpen] = useState(false);
  // One nav list for both of them — computed once rather than by each.
  const mobileNav = visibleNav({
    authenticated,
    isAdmin: Boolean(me.data?.isAdmin),
    isOperator: me.data?.role === "worldstreet",
  });

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
        <ConnectionBanner />
        {/* Mounted here too. The room renders bare, but a `$TICKER` is tappable
            wherever a caption is, and a control that works everywhere except
            one page is a control nobody trusts. It draws nothing until one is
            tapped. */}
        <TickerSheet />
        {/* No interest prompt here: the stream room owns the whole viewport,
            and a modal over a live broadcast is an interruption, not an
            onboarding. It waits until the reader leaves. */}
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
      <Sidebar
        pathname={pathname}
        onCompose={canCompose ? () => setComposeOpen(true) : undefined}
      />

      {/* Mobile top strip: the account on the left, the mark in the MIDDLE,
          and the two things worth reaching from anywhere on the right.
          The avatar is the door to everything the sidebar holds on desktop —
          it opens the same drawer the "More" tab does, so the account you are
          posting as is both visible and the way in, which is the arrangement
          every phone app in this category uses. */}
      <div className="ws-head fixed inset-x-0 top-0 z-40 flex h-12 items-center px-4 md:hidden">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="ws-press -ml-1 shrink-0 rounded-full p-1"
        >
          {authenticated ? (
            <Avatar
              name={me.data?.displayName ?? "Me"}
              seed={me.data?.id}
              src={me.data?.avatarUrl}
              size={28}
            />
          ) : (
            <IconUser className="h-6 w-6 text-meta" />
          )}
        </button>

        {/* Absolutely centred, so the mark sits on the middle of the SCREEN
            rather than the middle of whatever space the two sides leave —
            those change with the live pill and the signed-in state. */}
        <Wordmark
          height={26}
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        />

        <div className="ml-auto flex items-center gap-3">
          {broadcast.live && (
            <OnAirPill streamId={broadcast.streamId} compact />
          )}
          {/* Search only. Notifications live in the bottom tab bar, where they
              carry their unread badge — the bell here was the same
              destination a second time, without the count. */}
          <Link href="/discover" className="text-meta" aria-label="Explore">
            <IconSearch className="h-5 w-5" />
          </Link>
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
              "ws-hair min-h-dvh min-w-0 flex-1 overflow-x-clip border-x pt-[var(--ws-topbar-h)] pb-[var(--ws-nav-h)]",
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
      {/* Desktop only: on a phone the create button rides in the tab bar's
          row, where it cannot land on top of the bar or the composer. */}
      {canCompose && <CreateFab onClick={() => setComposeOpen(true)} />}

      <ComposeSheet open={composeOpen} onClose={() => setComposeOpen(false)} />

      {/* The one ticker sheet for the whole app. A `$BTC` in a caption is
          tappable on every surface that renders a post body, so the sheet is
          mounted once here and opened in place through `lib/ticker-store.ts`
          — the same arrangement the composer above uses, and for the same
          reason: tapping a coin must never cost the reader their page. */}
      <TickerSheet />

      <MobileBar
        pathname={pathname}
        items={mobileNav}
        unread={unread.data}
        onCompose={canCompose ? () => setComposeOpen(true) : undefined}
      />
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={mobileNav}
        pathname={pathname}
      />

      {/* First-load claim-username prompt for freshly created profiles. */}
      <ClaimUsernameGate />
      {/* ...then, once the account has a name, what they want to see. Ordered,
          not stacked — see the note in InterestGate. */}
      <InterestGate />
      {/* Session-expiry watchdog: logs out properly instead of half-stuck. */}
      <SessionGuard />
      {/* One sentence for the whole app when the backend is unreachable —
          see the note in the component for why it is not forty. */}
      <ConnectionBanner />
    </div>
  );
}
