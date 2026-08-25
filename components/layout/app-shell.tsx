"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { allowsCompose } from "@/lib/compose-surfaces";
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
import { ComposeSheet } from "@/components/layout/compose-sheet";
import { Sheet } from "@/components/ui/sheet";
import {
  IconBell,
  IconCalendar,
  IconCamera,
  IconDots,
  IconHome,
  IconLive,
  IconMail,
  IconMore,
  IconPlus,
  IconSearch,
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
}

// One ordered list drives the sidebar at every breakpoint. Primary items are
// always visible; secondary ones collapse into More on shorter rails.
//
// Spotlight is deliberately absent: the right rail's Citizen Spotlight module
// owns that surface and links into it, so a sidebar entry would be a second
// door to the same room.
const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/discover", label: "Explore", icon: IconSearch },
  { href: "/messages", label: "Messages", icon: IconMail, authed: true },
  { href: "/notifications", label: "Notifications", icon: IconBell, authed: true },
  { href: "/live", label: "Live", icon: IconLive },
  { href: "/tickets", label: "Tickets", icon: IconTicket, authed: true },
  { href: "/store", label: "Store", icon: IconStore },
  { href: "/schedule", label: "Schedule", icon: IconCalendar, authed: true, secondary: true },
  { href: "/studio", label: "Studio", icon: IconCamera, authed: true },
  { href: "/admin", label: "Admin", icon: IconShield, authed: true, admin: true, secondary: true },
  { href: "/operations", label: "Operations", icon: IconShield, authed: true, operator: true, secondary: true },
];

// Surfaces that need the full width: grids and dashboards drown inside a
// 600px reading column, so they drop the right rail and spread instead.
// Everything list-shaped stays in the column — including the Studio index and
// Schedule, whose rows read worse stretched across 1000px. Their detail views
// (the cockpit) are a different matter, hence the separate prefix list.
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
      aria-label={badge > 0 ? `${item.label}, ${badge} unread` : item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors",
        active
          ? "border border-white/15 bg-white/10 text-white"
          : "border border-transparent text-body hover:bg-white/[0.06]"
      )}
    >
      <span className={cn("relative shrink-0", active && "text-nav-dot")}>
        <Icon className="h-4 w-4" filled={active} />
        {badge > 0 && (
          <span className="tnum absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-featured px-1 text-[9px] font-bold text-ink">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="hidden text-[12px] font-bold xl:block">{item.label}</span>
      {/* Icon-rail tooltip, since the label is hidden below xl. */}
      <span className="ws-overlay pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-body group-hover:block xl:!hidden">
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
    <div className="relative xl:hidden">
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
        className="ws-press flex w-full items-center justify-center gap-2 rounded-full bg-accent p-3 font-bold text-ink xl:px-6"
        aria-label="Sign in"
      >
        <IconUser className="h-5 w-5 xl:hidden" />
        <span className="hidden xl:block">Sign in</span>
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
        <span className="hidden min-w-0 flex-1 xl:block">
          <span className="block truncate text-[12px] font-bold leading-4 text-white">
            {me.data?.displayName ?? "You"}
          </span>
          <span className="block truncate text-[10px] leading-[15px] text-white/40">
            @{me.data?.username ?? "…"}
          </span>
        </span>
        <IconDots className="hidden h-4 w-4 shrink-0 text-meta xl:block" />
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

  const visible = NAV.filter(
    (item) =>
      (!item.authed || authenticated) &&
      (!item.operator || me.data?.role === "worldstreet") &&
      // Presentation only. Every /admin route is enforced server-side, so a
      // non-admin who types the URL still gets a refusal.
      (!item.admin || Boolean(me.data?.isAdmin))
  );

  return (
    <aside className="ws-hair sticky top-0 z-40 hidden h-dvh shrink-0 flex-col items-center border-r bg-[#0f0f0f] px-3 py-5 md:flex xl:w-[224px] xl:items-stretch">
      {/* The wordmark lockup sits over its own hairline. */}
      <Link
        href="/"
        aria-label="Market Square home"
        title="Market Square"
        className="ws-press mb-4 flex items-center justify-center border-b border-white/10 pb-4 xl:justify-start xl:px-2.5"
      >
        {/* The wordmark needs width, so the icon rail wears the mark and the
            expanded sidebar wears the wordmark. */}
        <LogoMark size={32} className="xl:hidden" />
        <Wordmark height={14} className="hidden xl:block" />
      </Link>

      <nav className="flex flex-col gap-1" aria-label="Primary">
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
        <div className="hidden flex-col gap-1 xl:flex">
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
      <div className="mt-4 flex flex-col items-center gap-2 xl:items-stretch xl:px-1">
        {authenticated && onCompose && (
          <button
            onClick={onCompose}
            className="ws-press flex h-12 items-center justify-center gap-2 rounded-full bg-accent font-bold text-ink transition-colors hover:bg-white xl:h-13 xl:text-[17px]"
            aria-label="Post"
          >
            <IconPlus className="h-6 w-6 xl:hidden" />
            <span className="hidden xl:block">Post</span>
          </button>
        )}
        <Link
          href="/studio"
          className="ws-press flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 font-bold text-body transition-colors hover:bg-white/8 xl:h-13"
          aria-label="Go live"
        >
          <IconCamera className="h-5 w-5" />
          <span className="hidden xl:block">Go live</span>
        </Link>
      </div>

      <div className="mt-auto w-full border-t border-white/10 pt-4">
        {broadcast.live && (
          <div className="mb-2 flex justify-center xl:justify-start xl:pl-2">
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
  const visible = NAV.filter(
    (item) =>
      (!item.authed || authenticated) &&
      (!item.operator || me.data?.role === "worldstreet") &&
      (!item.admin || Boolean(me.data?.isAdmin))
  );
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
    <div className="mx-auto flex w-full max-w-[1600px] justify-center">
      <Sidebar pathname={pathname} onCompose={canCompose ? () => setComposeOpen(true) : undefined} />

      {/* Mobile top strip: wordmark plus the two things worth reaching from
          anywhere — what's live, and search. */}
      <div className="ws-head fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between px-4 md:hidden">
        <Wordmark height={16} />
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
        <div className="flex min-w-0 flex-1 justify-center">
          <main
            className={cn(
              "ws-hair min-h-dvh min-w-0 flex-1 border-x pt-12 pb-16 md:pt-0 md:pb-0",
              // Home carries the design's wider timeline; the other column
              // surfaces stay at the narrower reading width.
              !wide && (pathname === "/" ? "md:max-w-[720px]" : "md:max-w-[600px]")
            )}
          >
            {children}

            {/* The design's floating compose button (53×53, the silver ramp,
                a + glyph) floating at the column's outer edge — in the file it
                sits in the gutter between the column and the right rail. It
                was owned by the feed page, so it existed on home only; it
                belongs to the shell so every surface carries it.
                `main` is `min-h-dvh`, so `sticky bottom-6` floats against the
                viewport instead of stranding itself at the end of a short
                page. */}
            {canCompose && (
              <div className="pointer-events-none sticky bottom-6 z-30 ml-auto hidden w-fit md:block">
                <button
                  onClick={() => setComposeOpen(true)}
                  aria-label="Create post"
                  className="ws-btn-silver ws-press pointer-events-auto flex h-[53px] w-[53px] items-center justify-center rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-opacity hover:opacity-90"
                >
                  <IconPlus className="h-7 w-7" />
                </button>
              </div>
            )}
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
      {canCompose && (
        <button
          onClick={() => setComposeOpen(true)}
          aria-label="Create post"
          className="ws-press fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink shadow-[0_4px_24px_rgba(212,212,216,0.3)] md:hidden"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
        >
          <IconPlus className="h-6 w-6" />
        </button>
      )}

      <ComposeSheet open={composeOpen} onClose={() => setComposeOpen(false)} />

      <MobileBar pathname={pathname} />

      {/* First-load claim-username prompt for freshly created profiles. */}
      <ClaimUsernameGate />
      {/* Session-expiry watchdog: logs out properly instead of half-stuck. */}
      <SessionGuard />
    </div>
  );
}
