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
import { allowsCompose, allowsRailCompose } from "@/lib/compose-surfaces";
import { MARKET_FLAGS } from "@/lib/market-config";
import { toast } from "sonner";
import { useChatOpen } from "@/lib/chat-open-store";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { setSidebarHidden, useSidebarHidden } from "@/lib/sidebar-pref-store";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { useLogout } from "@/hooks/use-logout";
import { useBroadcastStatus } from "@/hooks/use-broadcast-status";
import { InterestGate } from "@/features/discovery";
import { useUnread } from "@/hooks/use-unread";
import { SessionGuard } from "@/components/layout/session-guard";
import { Avatar } from "@/components/ui/avatar";
import { LogoMark, Wordmark } from "@/components/ui/wordmark";
import {
  IconSbChat,
  IconSbCreators,
  IconSbExplore,
  IconSbGistrooms,
  IconSbHome,
  IconSbLibrary,
  IconSbLive,
} from "@/components/ui/sidebar-icons";
import { IconTopBell, IconTopCaret } from "@/components/ui/topbar-icons";
import { OnboardingFlow } from "@/components/layout/onboarding-flow";
import { FriendsPopup } from "@/components/layout/friends-popup";
import { RightRail } from "@/components/layout/right-rail";
import { BottomDock } from "@/components/layout/bottom-dock";
import { ComposeSheet } from "@/components/layout/compose-sheet";
import { TickerSheet } from "@/components/layout/ticker-sheet";
import { ConnectionBanner } from "@/components/layout/connection-banner";
import {
  IconBell,
  IconDots,
  IconChevronDown,
  IconMore,
  IconMic,
  IconPlus,
  IconLogout,
  IconSearch,
  IconShield,
  IconStore,
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
   * COMING SOON, and not shown at all — on any surface. The route still
   * resolves; only its door is gone until the product is ready to open it.
   */
  hidden?: boolean;
  /**
   * COMING SOON, and SHOWN — faded, inert, and answering a tap with this
   * message rather than the page. For the one entry ogazboiz wanted people to
   * see is on its way ("seen but disabled, as if faded, but they tap it").
   */
  soon?: string;
  /**
   * Promoted in the DESKTOP SIDEBAR. Defaults to true.
   *
   * Separate from `flag`, which hides an entry everywhere: this hides it from
   * one surface while the mobile tab bar and drawer keep it. The sidebar sits
   * under a breadcrumb bar that already carries a bell and an avatar, so an
   * entry can be redundant there and still be the only door on a phone.
   */
  sidebar?: boolean;
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
/*
  Four more left the rail, and none of them were destinations.

  Tickets and Arkmarks are RECORDS — what you bought, what you saved. They
  belong to you, so they moved under your own avatar with View profile and
  Log out, which is where a person looks for their own things.

  Schedule merged into the job it is part of. Scheduling a stream is a studio
  function, and it already has four real doors: the Live hub, your profile,
  the arena block and the feed's empty state. A fifth in the rail was a
  shortcut to a page nobody navigates to cold.

  Spotlight is deferred rather than dropped. Status is the LAST thing 2.0
  builds — it is only worth being seen once there is a room to be seen in —
  and until then a permanent rail entry advertises a system that does not
  exist. The route still resolves.
*/
const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: IconSbHome },
  // Hidden for now — coming soon, per ogazboiz. The route still resolves.
  { href: "/discover", label: "Explore", icon: IconSbExplore, hidden: true },
  /*
    Houses is a row of its own after all.

    The hallway at the top of Home shows the three rooms open now, which is an
    overview's job — but an overview is a summary, and a summary needs
    somewhere to point. Without a row, the only door to every other room was a
    "See all" that appears only when a fourth room exists.

    `/gist-rooms/[id]` still resolves whatever the flag says: a link somebody was
    sent has to work, and hiding an entry must never break a route.
  */
  /*
    IN THE SIDEBAR, and spelled "Gistrooms" — node 496:13107 draws it third,
    between Explore and Chat. It was `sidebar: false` on the older file, which
    left the hallway on Home as the only door to every room but the three open
    now. The ROUTE is unchanged; nothing already linked breaks.
  */
  {
    href: "/gist-rooms",
    label: "Gistrooms",
    icon: IconSbGistrooms,
    flag: "houses",
  },

  { href: "/messages", label: "Chat", icon: IconSbChat, authed: true },
  {
    href: "/notifications",
    label: "Notifications",
    icon: IconBell,
    authed: true,
    /*
      Off the SIDEBAR only, and deliberately not off the mobile bar.

      On desktop the breadcrumb's bell is the same destination with the same
      unread ring, so the row was the second of two doors to one place. On a
      phone there is no breadcrumb — `--ws-crumb-h` is 0 below md — and the
      mobile header carries no bell precisely because this entry exists. Take
      it out of `NAV` outright and a phone has no route to notifications at
      all, and no unread badge anywhere.
    */
    sidebar: false,
  },
  // Hidden for now — coming soon, per ogazboiz. The route still resolves.
  { href: "/live", label: "Live", icon: IconSbLive, secondary: true, hidden: true },
  /*
    LIBRARY is the saved-posts surface — node 496:13107 draws it sixth, on a
    bookmark, between Live and For Creators. The route stays `/arkmarks` and the
    control on a post is still the Arkmark: the design renamed the DESTINATION
    in the nav, not the act of saving, exactly as "For Creators" sits over
    `/studio`. Signed-in only, because a shelf of your own saved things is not
    a thing a guest has.
  */
  { href: "/arkmarks", label: "Library", icon: IconSbLibrary, authed: true },
  // Reachable by URL, by deep link and from Explore's Products tab — just
  // not promoted in the nav while `storeNav` is off.
  { href: "/store", label: "Store", icon: IconStore, flag: "storeNav" },
  /*
    Node 225:3252. The row's geometry was already this node's — 46px tall,
    `px-3.5 py-2.5`, `gap-3`, `rounded-xl`, 12/16 bold — so the design changed
    only what it says and what it shows: "For Creators", on the file's own
    MusicNotesPlus. The ROUTE is untouched; /studio still resolves and every
    link already sent to it still works.
  */
  {
    href: "/studio",
    label: "For Creators",
    icon: IconSbCreators,
    authed: true,
    secondary: true,
    // Seen, faded, and a tap says so — not a door yet.
    soon: "For Creators is coming soon",
  },
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
  /** Which surface is asking. Only the sidebar drops `sidebar: false` rows. */
  surface: "sidebar" | "mobile";
}): NavItem[] {
  return NAV.filter(
    (item) =>
      !item.hidden &&
      (options.surface !== "sidebar" || item.sidebar !== false) &&
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
/*
  `/gist-rooms/:id` joins the wide set.

  A gist room is TWO columns of its own — a 805 stage beside a 411 chat, per
  node 129:11748 — so the shell's right rail is a third column competing for
  the same width, and the room ends up squeezed into the centre while partner
  cards sit beside it. The room is the destination; nothing should share the
  screen with it.

  The INDEX stays narrow: `/gist-rooms` is a list of rooms, which reads better
  in the column with the rail beside it.
*/
const WIDE_PREFIX = ["/store/", "/operations/", "/studio/", "/gist-rooms/"];

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
        item.soon
          ? `${item.label} — ${item.soon}`
          : item.external
            ? `${item.label} (opens in a new tab)`
            : badge > 0
              ? `${item.label}, ${badge} unread`
              : item.label
      }
      aria-disabled={item.soon ? true : undefined}
      title={item.soon}
      // A coming-soon entry stays where it is and says so; it never
      // navigates. Not `disabled` on a link (links have no such state), so
      // the tap is caught and answered instead.
      onClick={
        item.soon
          ? (event) => {
              event.preventDefault();
              toast.info(item.soon!);
            }
          : undefined
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
        // Faded: the row is present and not yet a door.
        item.soon && "opacity-40 hover:bg-transparent",
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
  /**
   * "right" clears the collapsed rail; "above" stacks over the account chip;
   * "below" hangs from the top bar's avatar, its right edge on the trigger's.
   */
  align?: "right" | "above" | "below";
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
          : align === "below"
            ? Math.min(rect.right - width, window.innerWidth - width - 8)
            : Math.min(rect.left, window.innerWidth - width - 8);
      // "below" hangs from the trigger's foot. The rail menus grow upward from
      // its top, with 8px of breathing room so a short viewport clamps rather
      // than opening a menu whose first item is off-screen.
      const top = align === "below" ? rect.bottom + 8 : Math.max(8, rect.top - 8);
      setAt({ left: Math.max(8, left), top });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
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
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setOpen(false)}
            />
            <div
              role="menu"
              aria-label={label}
              style={{
                left: at.left,
                // The rail menus live at the rail's foot and grow upward from
                // the trigger; the top bar's hangs down from the avatar.
                ...(align === "below"
                  ? { top: at.top }
                  : { bottom: Math.max(8, window.innerHeight - at.top) }),
                width: 224,
              }}
              className="ws-popover fixed z-[61] rounded-2xl p-1.5"
            >
              {children(() => setOpen(false))}
            </div>
          </>,
          document.body,
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
          /* Node 496:13158 to the pixel: 199x50, radius 12, 3% white behind a
             10% hairline, 7 of padding and 11 between the avatar and the two
             lines. `p-2` was 8. */
          className="flex w-full items-center gap-[11px] rounded-xl border border-white/10 bg-white/[0.03] p-[7px] text-left transition-colors hover:bg-white/8"
        >
          <Avatar
            name={me.data?.displayName ?? "Me"}
            seed={me.data?.id}
            src={me.data?.avatarUrl}
            size={34}
            /* 34 behind the file's own 20% white ring — 496:13159. */
            className="ring-1 ring-inset ring-white/20"
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
      {(close) => <AccountMenuItems close={close} />}
    </RailMenu>
  );
}

/**
 * The account menu's entries. The rail's account chip and the top bar's
 * avatar open the same menu, so it is written once.
 */
function AccountMenuItems({ close }: { close: () => void }) {
  const logout = useLogout();
  const me = useMe();
  return (
    <>
      <Link
        href={me.data ? `/u/${me.data.username}` : "/auth"}
        onClick={close}
        className="block rounded-xl px-3 py-2.5 text-sm text-body transition-colors hover:bg-white/10"
      >
        View profile
      </Link>
      {/*
        View profile and Log out, and nothing else — ogazboiz's call
        ("it should only be view profile and logout here"). Tickets and
        Arkmarks sat here for a while as "what is yours"; both routes still
        resolve (/tickets, /arkmarks) and the profile's own tabs are the
        door to them now.
      */}
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

/*
  THE BRAND LOCKUP, IN ONE PLACE — node 496:13198.

  The file draws a 60.9x44.6 mark and sets " Square" beside it as LIVE TYPE at
  Geist 900, 22.56/17.58; `/logo.svg` is a DIFFERENT lockup — the mark with
  "Market Square" baked beside it in two stacked lines, at whatever weight the
  export happened to carry. The rail wore the assembled one and the phone's top
  strip wore the baked one, so the app introduced itself with two different
  logos depending on the width of the screen.

  This is that lockup as a component, so both surfaces draw the SAME artwork and
  the same type and can never drift again. Everything but the mark's height is
  derived from it, at the ratios the file sets, so a caller asks for one number.
*/
/** The mark's height in the source file — the size every ratio below is per. */
const LOCKUP_MARK_H = 44.6;
/** " Square", at the file's size, leading and gap (the string's leading space). */
const LOCKUP_TYPE_PX = 22.56;
const LOCKUP_LEAD_PX = 17.58;
const LOCKUP_GAP_PX = 6;

function BrandLockup({
  /** HEIGHT of the mark. The type follows it; the artwork keeps its own ratio. */
  markHeight = LOCKUP_MARK_H,
  /**
   * An accessible name, for a lockup that is NOT already inside a labelled
   * control. `role="img"` collapses mark and type into one name — without it
   * the phone's top strip would announce the bare word "Square".
   */
  label,
  /** Display is the CALLER's — the rail's copy is hidden until it has room. */
  className,
}: {
  markHeight?: number;
  label?: string;
  className?: string;
}) {
  const scale = markHeight / LOCKUP_MARK_H;
  return (
    <span
      {...(label ? { role: "img" as const, "aria-label": label } : {})}
      className={cn("items-center", className)}
    >
      <LogoMark size={markHeight} />
      {/* The file's string carries a leading space, which is the gap between
          mark and type; a space is not a layout instruction, so it is a margin
          here and the word is just the word. */}
      <span
        style={{
          marginLeft: LOCKUP_GAP_PX * scale,
          fontSize: LOCKUP_TYPE_PX * scale,
          lineHeight: `${LOCKUP_LEAD_PX * scale}px`,
        }}
        className="font-black tracking-[-0.01em] text-white"
      >
        Square
      </span>
    </span>
  );
}

/**
 * THE LABELLED DESKTOP RAIL — kept, and no longer mounted.
 *
 * `BottomDock` replaced it outright on desktop (748:15721). This is exported
 * rather than deleted because the decision is a product one and reversible in
 * a line: mount it back in `AppShell` and the eleven destinations return. Its
 * behaviour — the drag-to-resize, the icon collapse, the unread badges — is
 * intact and tested.
 */
export function Sidebar({
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
    surface: "sidebar",
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
      className="group/rail ws-hair sticky top-0 z-40 hidden h-[var(--ws-vvh,100dvh)] shrink-0 flex-col items-center overflow-hidden border-r bg-chrome px-3 pb-5 md:flex data-[rail=full]:items-stretch"
    >
      <RailHandle rail={rail} preview={preview} commit={commit} />
      {/*
        THE WORDMARK BLOCK IS EXACTLY AS TALL AS THE TOP BAR, so their
        two hairlines are one continuous line across the top of the app.

        It used to be `py-5` on the rail plus `pb-4` here, which put the rule at
        66px against the bar's 76 — ten pixels adrift, and read as a broken join
        rather than a deliberate offset. Node 129:11832 draws the rail's own
        head at 76 with a bottom hairline, the same 76 the bar is.

        `--ws-crumb-h` rather than a literal, so the two can never drift again;
        the rail's top padding is gone for the same reason — the block is the
        full height and centres its mark on 38, exactly as the bar centres its
        breadcrumb.
      */}
      <Link
        href="/"
        aria-label="Square home"
        title="Square"
        className="ws-press mb-4 flex h-[var(--ws-crumb-h)] shrink-0 items-center justify-center border-b border-white/10"
      >
        {/*
          THE LOCKUP IS ASSEMBLED, NOT AN ASSET — node 496:13198, and it lives
          in `BrandLockup` above, which the phone's top strip draws too. The
          ratios and the reason are there; only the two rail STATES are here.

          Collapsed, the mark stands alone at 28 — the type would be illegible
          in a 72px strip. Labelled, the whole lockup, at the file's own 44.6.

          CENTRED, and that is measured rather than assumed: the group is 148.9
          wide in a 224 header, sitting at 37.6 with 37.5 left over — the same
          inset both sides. It used to be pushed to the left edge once the rail
          was labelled.
        */}
        <LogoMark size={28} className="group-data-[rail=full]/rail:hidden" />
        <BrandLockup className="hidden group-data-[rail=full]/rail:flex" />
      </Link>

      {/* The collapse chevron is gone for now, at ogazboiz's word ("remove
          that collapse"). The rail still collapses by its drag edge and a
          double-click on it (RailHandle); only the button that advertised it
          is removed. */}

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

      {/*
        THE TWO ACTS, IN THE FILE'S ORDER — node 496:13107.

        Start Gistroom on the purple ramp at 38 tall, then Post gist in silver
        directly under it, both 38. It used to be Post gist on top with an
        OUTLINED "Go live" beneath: the file promotes starting a room to the
        filled control and demotes posting to the quiet one, which is the
        product saying what it is — a place to talk in a room first, a timeline
        second.

        IT NO LONGER GOES TO `/studio`. That is the CREATOR studio — where you
        go live — and starting a gist room needs no creator role and no house
        to belong to. The empty state on the rooms page says so in as many
        words: "anyone can walk in". Sending the button there put a role gate
        in front of an act that has none, so it goes to `/gist-rooms?open=1`,
        which opens the same sheet the rooms page's own control opens.
      */}
      <div className="mt-4 flex shrink-0 flex-col items-center gap-4 group-data-[rail=full]/rail:items-stretch group-data-[rail=full]/rail:px-3">
        <Link
          href="/gist-rooms?open=1"
          /* 90deg, not `ws-btn-create`'s 155: node 496:13280's handles run
             (0,0.5) to (1,0.5), which is straight across. Same two stops —
             --color-create into --color-create-deep — so this is the ramp the
             welcome screens already use rather than a new one. */
          className="ws-press ws-btn-welcome flex h-12 w-12 items-center justify-center gap-2 rounded-full text-[15px] font-medium transition-opacity hover:opacity-90 group-data-[rail=full]/rail:h-[38px] group-data-[rail=full]/rail:w-full"
          aria-label="Start a gistroom"
        >
          <IconMic className="h-4 w-4 shrink-0" />
          <span className="hidden items-center gap-1 group-data-[rail=full]/rail:flex">
            Start Gistroom
            {/* The file draws a chevron, so the control reads as opening a
                choice. It goes to the room composer, which IS that choice —
                a menu here would be a second one over the same page. */}
            <IconChevronDown className="h-[14px] w-[14px] shrink-0" />
          </span>
        </Link>
        {authenticated && onCompose && (
          <button
            onClick={onCompose}
            /* Square while the rail is icons — with no label to give it width
               a full-height pill came out 22px wide and read as a sliver. It
               takes the rail's width once labelled.
               `ws-btn-postgist` is node 407:17029 in full: the silver face, the
               4px ring that fades to near-black along the bottom, and DARK type
               on it. 16/22 at Geist 600 on -0.112 of tracking. */
            className="ws-press ws-btn-postgist flex h-12 w-12 items-center justify-center gap-2 text-[16px] font-semibold leading-[22px] tracking-[-0.112px] transition-opacity hover:opacity-90 group-data-[rail=full]/rail:h-[38px] group-data-[rail=full]/rail:w-full"
            aria-label="Post gist"
          >
            <IconPlus className="h-6 w-6 group-data-[rail=full]/rail:hidden" />
            <span className="hidden group-data-[rail=full]/rail:block">
              Post gist
            </span>
          </button>
        )}
      </div>

      <div className="mt-4 w-full shrink-0 border-t border-white/10 pt-4">
        {/*
          USE THE DOCK INSTEAD — a real switch, where settings sit: at the
          rail's foot, above your own name, labelled in the full rail and a
          bare switch with its tooltip in the icon rail. It replaced a small
          button under the wordmark that nobody found ("i cant see my
          toggle"). On: the rail tucks away on this device and the dock takes
          over; the dock carries the switch back (lib/sidebar-pref-store).
          It reads "off" here because while the rail is showing, the dock is
          not in charge.
        */}
        <div
          className="mb-3 flex items-center justify-center gap-3 group-data-[rail=full]/rail:justify-between group-data-[rail=full]/rail:px-2"
          title="Hide the sidebar and use the dock"
        >
          <span className="hidden min-w-0 group-data-[rail=full]/rail:block">
            <span className="block text-[12px] font-bold leading-4 text-body">Use the dock</span>
            <span className="block text-[11px] leading-4 text-meta">Hides this sidebar</span>
          </span>
          <button
            role="switch"
            aria-checked={false}
            aria-label="Use the dock instead of the sidebar"
            onClick={() => setSidebarHidden(true)}
            className="ws-press relative h-6 w-10 shrink-0 rounded-full bg-white/12 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-grey-400 transition-[left] duration-150 motion-reduce:transition-none" />
          </button>
        </div>
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

/**
 * THE TOP BAR — node 647:17439, read from the live file (updated 2026-09-10
 * 21:10) and checked against its render.
 *
 * 76 tall on `#121214` under a background blur: the lockup on the left (only
 * while the rail is unmounted — the rail carries its own, and two logos is one
 * too many) and the cluster on the right, top at 19 — the bell, 11, then the
 * avatar pill.
 *
 * ITS EDGES ARE THE CONTENT'S, NOT THE FRAME'S. The file insets the lockup 54
 * and the cluster 44 from a 1438 artboard; on this capped, centred layout that
 * left both hanging well past the column and the rail beneath ("it look as if
 * the header is wider than the content"). So the bar's content is exactly as
 * wide as that group and centred the same way: the 600 column, plus the
 * 371 rail from lg with the rail's own 24 of right padding. The logo starts on
 * the column's edge and the cluster ends on the rail cards' edge. A WIDE route
 * has no column cap and no rail, so there the bar just keeps 24 either side.
 *
 * NO SEARCH. A build from a cached copy of this node (2026-09-08) put a field
 * here; the live node has none, which is also what ogazboiz asked for twice.
 *
 * THE HAIRLINE RUNS THE WHOLE WINDOW — "the border line should full the
 * screen for point A to point B". It is the file's 10% bottom stroke drawn as
 * a 1px line 200vw wide centred on the bar, so however far the frame sits from
 * either edge the line reaches both; the shell wrapper clips horizontal
 * overflow so that width never turns into a scrollbar.
 */
function TopBar({ showBrand, wide }: { showBrand: boolean; wide: boolean }) {
  return (
    <div
      className={cn(
        "sticky top-0 z-30 hidden h-[76px] shrink-0 items-start bg-chrome backdrop-blur-[6px] md:flex",
        "after:pointer-events-none after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-[200vw] after:-translate-x-1/2 after:bg-white/10",
        (!showBrand || wide) && "px-6"
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-start",
          showBrand && !wide && "mx-auto max-w-[600px] lg:max-w-[971px] lg:pr-6"
        )}
      >
        {showBrand && (
          <Link
            href="/"
            aria-label="Square home"
            title="Square"
            className="ws-press flex h-[76px] shrink-0 items-center"
          >
            <BrandLockup className="flex" />
          </Link>
        )}

        <div className="ml-auto flex shrink-0 items-start pl-6 pt-[19px]">
          <TopBarActions />
        </div>
      </div>
    </div>
  );
}

/**
 * THE CURRENT LOCATION — node 225:3684.
 *
 * A 293x38 pill at `rgba(151,151,151,0.05)` holding a 32px mark, then a
 * two-line column at gap -7 — the label at Roboto 11/16.5 in `#A1A1AA`
 * over the place itself at Geist SemiBold 16/25.85 in `#D9D9D9` — and a caret
 * at the right edge.
 *
 * ─── IT IS LIVE ──────────────────────────────────────────────────────────────
 * `city` and `region` are on `PublicProfile`, and `PATCH /me` writes them, so
 * this reads what the person has published and the caret opens the two fields
 * that set it. With nothing set it says "Set location" — an invitation rather
 * than a placeholder, and never a street nobody supplied.
 *
 * ─── A NAMED PLACE, NOT A POSITION ───────────────────────────────────────────
 * The words are the reader's own and they can clear them in one press. This is
 * deliberately not a device reading: `lib/api/schemas.ts` drops any `latitude`,
 * `longitude` or `distanceKm` a backend sends, and the sheet behind the caret
 * has no "detect me" button. A place somebody published is a fact they chose; a
 * position is recomputed every time a stranger looks.
 *
 * The design draws "108 Opebi Ikeja, Lagos" — a door number. The service
 * deliberately stores city and region only, so this renders "Ikeja, Lagos".
 * That precision is one migration away if product asks for it, WITH a rule
 * about who may read it; it is not something to acquire by accident.
 */

function TopBarActions() {
  const { ready, authenticated, login } = useAuth();
  const me = useMe();
  const unread = useUnread();
  const notifications = unread.data?.notifications ?? 0;

  /*
    A GUEST'S WAY IN LIVES HERE, because the sidebar that used to hold it is
    not rendered for them (see the note at the `Sidebar` call site). Top-right
    of the chrome is where every product in this category puts it, and it is
    the one piece of furniture a signed-out visitor still has.

    Nothing at all while Privy is settling: a Sign in button that appears for
    half a second and is replaced by an avatar is worse than a moment of
    nothing.
  */
  if (ready && !authenticated) {
    return (
      <button
        type="button"
        onClick={login}
        className="ws-press flex h-9 shrink-0 items-center rounded-full bg-white px-4 text-[14px] font-semibold text-ink transition-colors hover:bg-white/90"
      >
        Sign in
      </button>
    );
  }

  if (!authenticated) return null;

  return (
    <div className="flex shrink-0 items-center gap-[11px]">
      {/*
        647:17443 — the bell: 38, round, and the file's GLASS effect. The API
        does not publish GLASS's parameters (the node's own fill and stroke
        are hidden), so it is matched to the file's render, sampled at 4x: a
        body that darkens toward the top-left and lightens toward the
        bottom-right about the bar's own #121214, and a 1px rim that catches
        the light at the top-left (~64% white) and bottom-right (~54%) and
        fades to nothing on the other diagonal (`ws-glass-rim`). The glyph is
        the exported vuesax bell at the file's #DCDCDC.
      */}
      <Link
        href="/notifications"
        aria-label={
          notifications > 0
            ? `Notifications, ${notifications} unread`
            : "Notifications"
        }
        className="ws-press ws-glass-rim relative flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#0A0A0C_0%,#121214_50%,#1A1A1C_100%)] text-[#DCDCDC] transition-colors hover:text-white"
      >
        <IconTopBell className="h-6 w-6" />
        {notifications > 0 && (
          /*
            647:18433 — 9 x 9 at (20.24, 9) on the button, #9F5AFF inside a 1px
            #0D0D0F ring, the count in white. The file draws "6"; this shows
            the real number, and past 9 it reads "9+" and grows sideways rather
            than shrinking the type below legibility.
          */
          <span
            aria-hidden
            className="absolute left-[20.24px] top-[9px] flex h-[9px] min-w-[9px] items-center justify-center rounded-full bg-[#9F5AFF] px-[1.5px] text-[6px] font-semibold leading-none text-white ring-1 ring-inset ring-[#0D0D0F]"
          >
            {notifications > 9 ? "9+" : notifications}
          </span>
        )}
      </Link>

      {/*
        946:15827 — ONE pill holding the avatar and the caret: 7% white, radius
        36, padding 3 / 8 / 3 / 3, the avatar (34, a 20% white ring over 10%
        white) and the exported caret 23 after it. The caret is laid out as the
        file's 8 x 4 and its 11 x 7 export overflows that box by the stroke;
        a 1px pull, not the arithmetic 1.5, is what lands it on the file's
        render (measured: 1.5 left it half a pixel up and left).
        The whole pill opens the account menu: View profile and Log out. The
        hover tint is not in the file; a control with no hover reads as dead.
      */}
      <RailMenu
        label="Account"
        align="below"
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`Account menu for @${me.data?.username ?? "you"}`}
            className="ws-press flex items-center gap-[23px] rounded-[36px] bg-white/[0.07] py-[3px] pl-[3px] pr-2 transition-colors hover:bg-white/[0.11]"
          >
            <span className="flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
              <Avatar
                name={me.data?.displayName ?? "Me"}
                seed={me.data?.id}
                src={me.data?.avatarUrl}
                size={32}
              />
            </span>
            <span className="relative h-[4px] w-[8px] shrink-0 text-white">
              <IconTopCaret className="absolute -left-px -top-px h-[7px] w-[11px]" />
            </span>
          </button>
        )}
      >
        {(close) => <AccountMenuItems close={close} />}
      </RailMenu>
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
/**
 * THE SIDEBAR, ON A PHONE.
 *
 * It used to be a two-column grid of chips inside a centred `Sheet` — the same
 * destinations, drawn as a completely different object. So the nav a person
 * learned on the desktop was not the nav they met on their phone: different
 * shape, different order, no badges, no active treatment, and Go live missing
 * entirely.
 *
 * This is the sidebar. Literally: the rows are `NavLink`, the same component
 * the rail renders, with the same active tint, the same unread badges from
 * `BADGE_FOR`, the same primary/secondary split, and the same Go live and
 * account footer. Wrapping the panel in `group/rail` with `data-rail="full"` is
 * what makes those rows render in their LABELLED state — the identical class
 * hook the expanded rail sets — so there is one nav component in the app and no
 * second copy to drift.
 *
 * ─── WHY A LEFT DRAWER AND NOT A SHEET ───────────────────────────────────────
 * A nav that slides from the left is where every reader's hand already expects
 * it, and it matches the side the sidebar occupies on a wider screen. The old
 * `Sheet` arrived from the centre, which reads as a dialog interrupting you
 * rather than a panel you opened.
 *
 * It closes on a route change, on Escape, and on the scrim. The body is
 * scroll-locked while it is open, or the page behind it moves under the panel.
 */
function MobileMenu({
  open,
  onClose,
  items,
  pathname,
  unread,
  onCompose,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  pathname: string;
  unread: { messages: number; notifications: number } | undefined;
  onCompose?: () => void;
}) {
  const { ready, authenticated, login } = useAuth();
  const me = useMe();
  const logout = useLogout();

  // A route change means the drawer did its job.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close on navigation only
  }, [pathname]);

  // Escape closes it, and the page behind stops scrolling while it is open —
  // otherwise a drag on the scrim moves the timeline under the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60"
      />

      {/* `data-rail="full"` is the whole trick: `NavLink` reads it to decide
          whether it is a labelled row or a bare glyph, so the sidebar's own
          rows render here unchanged. */}
      <div
        data-rail="full"
        className="group/rail ws-hair absolute inset-y-0 left-0 flex w-[85%] max-w-[300px] flex-col border-r bg-chrome px-3 pb-5"
      >
        <div className="flex h-[76px] shrink-0 items-center border-b border-white/10 px-2.5">
          <Wordmark height={30} />
        </div>

        <nav
          aria-label="Primary"
          className="mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items
            .filter((item) => !item.secondary)
            .map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                badge={BADGE_FOR[item.href]?.(unread) ?? 0}
              />
            ))}
          {/* Secondary rows are folded away on the icon rail for width. A
              drawer has the width, so they are simply listed. */}
          {items
            .filter((item) => item.secondary)
            .map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
              />
            ))}
        </nav>

        <div className="mt-4 flex shrink-0 flex-col gap-2">
          {authenticated && onCompose && (
            <button
              onClick={() => {
                onClose();
                onCompose();
              }}
              className="ws-press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-bold text-ink transition-colors hover:bg-white"
            >
              <IconPlus className="h-4 w-4" />
              Post gist
            </button>
          )}

          {ready && !authenticated ? (
            <button
              onClick={() => {
                onClose();
                login();
              }}
              className="ws-press flex h-11 w-full items-center justify-center rounded-full border border-white/15 text-[14px] font-semibold text-white"
            >
              Sign in
            </button>
          ) : (
            <div className="ws-hair flex items-center gap-2 border-t pt-3">
              <Link
                href={me.data ? `/u/${me.data.username}` : "/auth"}
                onClick={onClose}
                className="ws-press flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-white/[0.06]"
              >
                <Avatar
                  name={me.data?.displayName ?? "Me"}
                  seed={me.data?.id}
                  src={me.data?.avatarUrl}
                  size={34}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-heading">
                    {me.data?.displayName ?? "You"}
                  </span>
                  <span className="block truncate text-[11px] text-meta">
                    @{me.data?.username ?? "…"}
                  </span>
                </span>
              </Link>
              <button
                onClick={() => {
                  onClose();
                  void logout();
                }}
                aria-label="Sign out"
                className="ws-press shrink-0 rounded-full p-2 text-meta transition-colors hover:bg-white/10 hover:text-body"
              >
                <IconLogout className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * THE PHONE'S TAB BAR — kept, and no longer mounted.
 *
 * `BottomDock` (748:15721) is the app's only bottom navigation now, at every
 * width: it replaced the desktop sidebar first and this second, so a phone and
 * a laptop no longer carry two different bottom bars. Exported rather than
 * deleted for the same reason `Sidebar` is — the decision is a product one and
 * reversible by mounting it back.
 *
 * WHAT THE PHONE LOSES WITH IT: Explore and Gistrooms, which were two of its
 * four tabs and are not among the dock's three. Both routes still work, and the
 * drawer behind the top strip's avatar still lists the entire nav, which is the
 * same door the removed "More" tab used to open.
 */
export function MobileBar({
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
  // A chat thread being typed into — the dock stays out of its way.
  const chatOpen = useChatOpen();
  // The reader tucked the desktop rail away and uses the dock instead.
  const sidebarHidden = useSidebarHidden();
  useTrackNavHistory();
  const { ready, authenticated } = useAuth();
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
    surface: "mobile",
  });

  // One piece of local state drives every compose entry point in the shell —
  // sidebar Post, the desktop floating button and the mobile one. They all sit
  // inside this component, so a prop is enough; no context store required.
  const canCompose = authenticated && allowsCompose(pathname);
  /** Somebody looking around: settled, and not signed in. */
  const guest = ready && !authenticated;
  // The desktop rail is drawn: flagged on, signed in, and not tucked away.
  const railOn = MARKET_FLAGS.sidebar && !guest && !sidebarHidden;

  /*
    ONE SOURCE OF VIEWPORT TRUTH, published for the whole shell.

    `--ws-vvh` is `window.visualViewport.height` — what is actually on the
    glass. It lives here rather than in the messages page because the SIDEBAR
    and `main` size themselves off the viewport too, and two elements measuring
    the same window in two different units is the bug: `main` in `100dvh`, the
    chat pane in `--ws-vvh`. Disagree by one pixel and `main` grows past its
    min-height, the document scrolls, and the `h-dvh` sidebar stops short of
    the bottom — which is exactly the black band under the WHOLE app, sidebar
    included, that appears on scrolling with a thread open.

    Unset (no visualViewport) everything falls back to `100dvh`, which is the
    behaviour this replaces.
  */
  useKeyboardInset();

  /*
    A CHAT THREAD CLAIMS THE VIEWPORT, so the page must not scroll behind it.

    Sizing alone is not enough to guarantee that — every element has to agree
    to the pixel, and a rounded half-pixel anywhere puts a scrollbar back. The
    route's own contract is simpler and can be stated outright: on `/messages`
    with a thread open, the MESSAGE LIST scrolls and nothing else does. Same
    lock the drawer and the sheets already use.
  */
  useEffect(() => {
    if (!chatOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [chatOpen]);

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
        {/* NOTHING here. The bare routes are the live room and the cockpit:
            they own the whole viewport, and a four-screen onboarding over a
            broadcast is not an onboarding, it is an interruption that can end
            somebody's stream. The old username gate was mounted here for the
            same reason it was everywhere — it was a small sheet. This is not,
            and it waits until the reader leaves. */}
      </>
    );
  }

  return (
    // CAPPED AND CENTRED — `--ws-shell-max`, which carries the derivation.
    //
    // This read "Full width" and gave the reason the old 1600px cap was
    // removed: the slack was "parked at the right edge — the app looked
    // left-aligned on the screens with the most room to give". That diagnosis
    // was right and the remedy was wrong. A cap parks its leftover on one side
    // only when nothing centres it; `mx-auto` splits it, which is why X can cap
    // its frame and still look centred on any monitor.
    //
    // Uncapped, the timeline kept widening with the window — at 2560 the
    // column ran past 1900px and a post became a line the eye has to track all
    // the way back across, while the right rail drifted away from the column
    // it annotates. `justify-start` below stays correct: the slack now falls
    // OUTSIDE this frame, so there is no dead band left inside it to collect.
    /*
      THE GUTTERS RHYME WITH THE FRAME.

      Capping the shell created a seam nobody had before it: `body` is `#000`
      and the frame is `--color-chrome` `#121214`, so on any screen wider than
      the cap the leftover painted pure black either side of a lighter panel —
      a hard vertical edge down both sides of the app.

      Painted on a FULL-WIDTH wrapper rather than on `body`, deliberately. The
      live room renders OUTSIDE this shell (`/live/:id` returns early above)
      and its stage is meant to sit on pure black; moving the page colour would
      have lightened the ground behind every video without anyone asking. This
      way the chrome reaches the window's edges exactly where the shell is on
      screen, and nowhere else.

      `min-h-dvh` so a short route does not leave the ground stopping partway
      down with black beneath it.
    */
    /* `data-rail` tells the STYLESHEET whether a dock is on screen, so
       `--ws-nav-h` can be 0 where there is none — see globals.css. Every
       consumer of that variable then agrees without knowing about the rail. */
    <div className="min-h-dvh w-full overflow-x-clip bg-chrome" data-rail={railOn ? "on" : "off"}>
      <div className="mx-auto flex w-full max-w-[var(--ws-shell-max)]">
        {/*
        GUESTS GET NO SIDEBAR.

        Signed out, every row in it either leads somewhere that immediately
        asks you to sign in or is a control you cannot use — so the rail was
        260px of the widest thing on screen spent on a menu of refusals, with
        the reader's actual business squeezed beside it. Somebody looking around
        should just be looking at the square.

        Gated on `ready && !authenticated`, not on `!authenticated` alone: while
        Privy is still settling, `authenticated` is false for everyone, and
        hiding the rail on that would pull the whole layout sideways under a
        signed-in reader and then push it back. Boot happens under the splash,
        so nobody sees the rail appear.

        The way IN moves to the breadcrumb — see `TopBarActions`. Removing the
        rail without moving it would leave a guest on desktop with no sign-in
        anywhere.
      */}
        {/*
          NO SIDEBAR BY DEFAULT — replaced by `BottomDock` (748:15721), which
          carries three destinations against the rail's eleven. Gistrooms,
          Notifications, Live, Library, Store, Studio, Admin and Operations are
          not linked from the dock; every route still works, every deep link
          still resolves, and the drawer behind the top strip's avatar still
          lists the entire nav.

          BEHIND A SWITCH, so it is one environment variable rather than a
          rebuild: `NEXT_PUBLIC_MS_SIDEBAR_ENABLED=true` brings the rail back
          on desktop with everything it had, and the dock steps back to phones
          only — the two must never both claim the navigation.
        */}
        {railOn && (
          <Sidebar
            pathname={pathname}
            onCompose={
              authenticated && allowsRailCompose(pathname)
                ? () => setComposeOpen(true)
                : undefined
            }
          />
        )}

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

          {/* THE RAIL'S LOCKUP, NOT `/logo.svg`. The strip used to wear the
            baked wordmark — the mark with "Market Square" stacked beside it —
            while the rail wore the assembled one, so the app had two logos.
            `BrandLockup` is the rail's, and this is the same call it makes.

            THE MARK IS 28, which is the size the rail itself falls back to when
            it has no room (the icon state above): the strip is 48 tall, so the
            file's 44.6 would sit hairline-to-hairline, and 28 leaves the same
            10px of air top and bottom that the 28px avatar beside it does.

            Absolutely centred, so the mark sits on the middle of the SCREEN
            rather than the middle of whatever space the two sides leave —
            those change with the live pill and the signed-in state. Centred on
            BOTH axes rather than leaning on an abspos child's static position,
            which is the flex container's alignment and not a promise. */}
          <BrandLockup
            markHeight={28}
            label="Square"
            className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2"
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

        {/*
        The breadcrumb spans the column and the rail together, so both live
        inside one flex-column beside the sidebar.

        THE GROUND IS PAINTED HERE, on everything right of the sidebar —
        `--color-chrome` (`#121214`) at FULL opacity, the same value the rail
        and the breadcrumb bar carry, so the whole frame is one surface. It was on Home's own column first and then on `main`,
        and both left a SEAM: the right rail carries no background of its own,
        so a lighter pane beside it drew a visible edge down the page. One
        ground under the bar, the column and the rail is the only place it
        cannot show a join.

        `--color-ground` stays `#000` for the app at large; this is the shell's
        content frame, not a palette change.
      */}
        <div className="flex min-w-0 flex-1 flex-col bg-chrome">
          <TopBar showBrand={!railOn} wide={wide} />
          {/* justify-START, not center. Centering the column+rail group inside
            the leftover width of the 1600px shell split that slack in two and
            left a dead band between the sidebar and the column — the column
            read as floating away from the nav that selects it. Packed left,
            the column sits against the sidebar and the slack collects once, at
            the outer edge, where the shell's own mx-auto already balances it. */}
          {/* Packed against the rail while there is one (see above); with the
              rail tucked away and the dock in charge there is nothing to pack
              against, and a column hugging the window's left edge under a
              centred dock reads as lopsided. Then the group is centred, which
              is where the dock already is. */}
          <div className={cn("flex min-w-0 flex-1", railOn ? "justify-start" : "justify-center")}>
            <main
              className={cn(
                // Padding, not margin, and from the shared chrome vars rather
                // than hand-matched numbers: pb-16 was 64px against a 69px tab
                // bar, so the last five pixels of every column surface sat
                // underneath it.
                // NO overflow clip of its own. A child wider than a phone (a
                // fixed-width CTA, a row of shrink-0 groups) would drag the page
                // sideways, and the SHELL's wrapper clips at the window for
                // that. Clipping here as well cut every line meant to run past
                // the column: Home's rule under "Make some friends" has to reach
                // the window's left edge under the dock ("we need this line to
                // reach the extreme end in the left hand side"), as the top
                // bar's does. Rails that are MEANT to scroll set their own
                // overflow-x-auto, and anything that needs a horizontal
                // scrollbar must still opt into one explicitly.
                //
                // 600 WIDE, LIKE X'S TIMELINE. The column briefly had no cap
                // at all — every pane flexed to the window — and on a 1440
                // display the feed ran to ~860, so a portrait clip drawn at its
                // own width sat beside a slab of empty card. The reader's
                // verdict was "the main feed is too wide", against X's 600, and
                // 600 is also what every other column surface already holds.
                // Wide routes (store, studio, operations, schedule) are exempt:
                // they drop the rail and are meant to spread. Whatever the
                // window has left collects at the outer edge, past the rail,
                // where the shell's own mx-auto balances it.
                // `100dvh` MINUS the breadcrumb, not `min-h-dvh`. The bar is a
                // sibling above this in the same flex column, so a full-viewport
                // minimum made the document exactly one bar taller than the
                // window and every short route grew a scrollbar with 76px of
                // nothing under it. `--ws-crumb-h` is 0 on a phone, where the
                // bar is `hidden md:flex`, so this is identical there.
                "ws-hair min-h-[calc(var(--ws-vvh,100dvh)-var(--ws-crumb-h))] min-w-0 flex-1 pt-[var(--ws-topbar-h)] lg:border-r",
                // The LEFT hairline separates the column from the SIDEBAR, so
                // it exists only while the sidebar does. Under the dock it
                // would cut down the line the top bar's logo starts on ("there
                // is no vertical line border line so remove that when it is on
                // dock... i meant in the left side"). The right one divides the
                // column from the RAIL, so it is drawn from lg, where the rail
                // is; below that it would be a lone line beside nothing.
                railOn && "border-l",
                // The foot reserves the dock's row — except over an open chat,
                // where the dock is gone and the reservation would be a blank
                // band under the composer. WhatsApp's rule: the field sits on
                // the screen's bottom edge at every height.
                chatOpen ? "pb-0" : "pb-[var(--ws-nav-h)]",
                !wide && "max-w-[600px]"
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
        {/* Desktop compose is the dock's own circle now — the floating
            `CreateFab` was the same act in the same corner, and two plus
            buttons a few pixels apart is what mounting both would be. */}
        {/* NOT OVER AN OPEN CHAT. The dock's row is the message composer's
            row; over a thread it covered the field on a phone and floated
            across the thread's foot on desktop. `MessagesPage` reports the
            open thread through `lib/chat-open-store`, and the dock returns
            the moment the thread closes. */}
        {!chatOpen && (
        <BottomDock
          guest={guest}
          /*
            Phones only when the rail is ACTUALLY on screen, which is the flag
            AND a signed-in reader — guests never get a sidebar. Keyed on the
            flag alone, a signed-out visitor on desktop got neither: the rail
            was suppressed for being a guest and the dock was hidden for the
            rail's benefit, leaving no navigation at all. Found by turning the
            switch on and looking, which is the only way that shows up.
          */
          className={railOn ? "md:hidden" : undefined}
          onCompose={canCompose && !guest ? () => setComposeOpen(true) : undefined}
          // The way back, on desktop only: the dock is standing in for a rail
          // the reader tucked away, so it carries the switch that restores it.
          onShowSidebar={
            MARKET_FLAGS.sidebar && !guest && sidebarHidden
              ? () => setSidebarHidden(false)
              : undefined
          }
        />
        )}

        <ComposeSheet
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
        />

        {/* "You and Fola are now friends" — 647:16628. Reads the signed-in
            reader's unread social notifications once and shows the one moment
            worth a popup; see components/layout/friends-popup. */}
        {ready && !guest && <FriendsPopup />}

        {/* The one ticker sheet for the whole app. A `$BTC` in a caption is
          tappable on every surface that renders a post body, so the sheet is
          mounted once here and opened in place through `lib/ticker-store.ts`
          — the same arrangement the composer above uses, and for the same
          reason: tapping a coin must never cost the reader their page. */}
        <TickerSheet />

        {/* The phone's tab bar is gone — `BottomDock` above serves every
            width now. See the note on `MobileBar`. */}
        <MobileMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          items={mobileNav}
          pathname={pathname}
          unread={unread.data}
          onCompose={canCompose ? () => setComposeOpen(true) : undefined}
        />

        {/*
        ONBOARDING — and it REPLACES the bare username gate.

        `ClaimUsernameGate` was step 2 of this flow on its own: a sheet that
        asked for a name and nothing else. The four screens the file draws
        (107:1821, 122:2906, 125:3616, 126:3769) carry that same claim plus the
        welcome, the permissions and the people, so the gate is folded in rather
        than shown alongside it — two things asking for a username, one stacked
        over the other, in somebody's first ten seconds.
      */}
        <OnboardingFlow />
        {/* ...then, once the account has a name, what they want to see. Ordered,
          not stacked — see the note in InterestGate. */}
        <InterestGate />
        {/* Session-expiry watchdog: logs out properly instead of half-stuck. */}
        <SessionGuard />
        {/* One sentence for the whole app when the backend is unreachable —
          see the note in the component for why it is not forty. */}
        <ConnectionBanner />
      </div>
    </div>
  );
}
