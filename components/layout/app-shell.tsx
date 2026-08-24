"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { useLogout } from "@/hooks/use-logout";
import { useBroadcastStatus } from "@/hooks/use-broadcast-status";
import { ClaimUsernameGate } from "@/features/profile";
import { SessionGuard } from "@/components/layout/session-guard";
import { Avatar } from "@/components/ui/avatar";
import { RightRail } from "@/components/layout/right-rail";
import {
  IconBell,
  IconCalendar,
  IconCamera,
  IconDots,
  IconHome,
  IconLive,
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
  { href: "/notifications", label: "Notifications", icon: IconBell, authed: true },
  { href: "/live", label: "Live", icon: IconLive },
  { href: "/tickets", label: "Tickets", icon: IconTicket, authed: true },
  { href: "/store", label: "Store", icon: IconStore },
  { href: "/schedule", label: "Schedule", icon: IconCalendar, authed: true, secondary: true },
  { href: "/studio", label: "Studio", icon: IconCamera, authed: true },
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

/** Sidebar row: icon at every width, label only once the rail is expanded. */
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "ws-nav group flex items-center gap-4 p-3 xl:pr-6",
        active ? "text-heading" : "text-body"
      )}
    >
      <span className="relative shrink-0">
        <Icon className="h-6 w-6" filled={active} />
      </span>
      <span
        className={cn(
          "hidden text-xl xl:block",
          active ? "ws-display font-bold" : "font-medium"
        )}
      >
        {item.label}
      </span>
      {/* Icon-rail tooltip, since the label is hidden below xl. */}
      <span className="ws-overlay pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-body group-hover:block xl:!hidden">
        {item.label}
      </span>
    </Link>
  );
}

function MoreMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  if (items.length === 0) return null;
  return (
    <div className="group relative xl:hidden">
      <button
        aria-label="More"
        className="ws-nav flex w-full items-center gap-4 p-3 text-body"
      >
        <IconMore className="h-6 w-6 shrink-0" />
      </button>
      <div className="ws-glass absolute bottom-0 left-full z-50 ml-2 hidden w-52 rounded-2xl p-1.5 group-focus-within:block group-hover:block">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
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

  return (
    <div className="group relative">
      <Link
        href={me.data ? `/u/${me.data.username}` : "/auth"}
        className="flex w-full items-center gap-3 rounded-full p-2 transition-colors hover:bg-white/8"
      >
        <Avatar name={me.data?.displayName ?? "Me"} src={me.data?.avatarUrl} size={40} />
        <span className="hidden min-w-0 flex-1 xl:block">
          <span className="block truncate text-sm font-bold text-heading">
            {me.data?.displayName ?? "You"}
          </span>
          <span className="block truncate text-sm text-meta">
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

function Sidebar({ pathname }: { pathname: string }) {
  const { authenticated } = useAuth();
  const me = useMe();
  const broadcast = useBroadcastStatus();

  const visible = NAV.filter(
    (item) =>
      (!item.authed || authenticated) &&
      (!item.operator || me.data?.role === "worldstreet")
  );

  return (
    <aside className="sticky top-0 z-40 hidden h-dvh shrink-0 flex-col items-center px-1 py-1 md:flex xl:w-[268px] xl:items-stretch xl:px-2">
      <Link
        href="/"
        aria-label="Market Square home"
        title="Market Square"
        className="ws-press mt-1 mb-1 flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-white/8 xl:ml-1"
      >
        <span className="ws-display flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-lg text-ink">
          M
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5" aria-label="Primary">
        {visible
          .filter((item) => !item.secondary)
          .map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        {/* Expanded rail shows everything; the icon rail folds the rest away. */}
        <div className="hidden flex-col gap-0.5 xl:flex">
          {visible
            .filter((item) => item.secondary)
            .map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
        </div>
        <MoreMenu items={visible.filter((item) => item.secondary)} pathname={pathname} />
      </nav>

      {/* Post is the primary act; going live is the one Market Square adds
          next to it, so it sits directly underneath as the quiet twin. */}
      <div className="mt-4 flex flex-col items-center gap-2 xl:items-stretch xl:px-1">
        <Link
          href="/?compose=1"
          className="ws-press flex h-12 items-center justify-center gap-2 rounded-full bg-accent font-bold text-ink transition-colors hover:bg-white xl:h-13 xl:text-[17px]"
          aria-label="Post"
        >
          <IconPlus className="h-6 w-6 xl:hidden" />
          <span className="hidden xl:block">Post</span>
        </Link>
        <Link
          href="/studio"
          className="ws-press flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 font-bold text-body transition-colors hover:bg-white/8 xl:h-13"
          aria-label="Go live"
        >
          <IconCamera className="h-5 w-5" />
          <span className="hidden xl:block">Go live</span>
        </Link>
      </div>

      <div className="mt-auto w-full pb-2">
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

function MobileBar({ pathname }: { pathname: string }) {
  const { authenticated } = useAuth();
  const router = useRouter();
  const me = useMe();

  // Five slots, profile included — six icons crowd a 390px bar. Tickets and
  // Store stay one tap away through Explore and the profile menu.
  const tabs = NAV.filter(
    (item) => !item.secondary && item.href !== "/studio" && (!item.authed || authenticated)
  ).slice(0, 4);

  return (
    <nav
      className="ws-head fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-b-0 border-t md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      {tabs.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={cn(
              "ws-press flex flex-1 items-center justify-center py-3",
              active ? "text-heading" : "text-meta"
            )}
          >
            <item.icon className="h-6 w-6" filled={active} />
          </Link>
        );
      })}
      <button
        onClick={() => router.push(me.data ? `/u/${me.data.username}` : "/auth")}
        aria-label="Profile"
        className="ws-press flex flex-1 items-center justify-center py-3 text-meta"
      >
        <IconUser className="h-6 w-6" />
      </button>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { authenticated } = useAuth();
  const broadcast = useBroadcastStatus();

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
    <div className="mx-auto flex w-full max-w-[1280px] justify-center">
      <Sidebar pathname={pathname} />

      {/* Mobile top strip: wordmark plus the two things worth reaching from
          anywhere — what's live, and search. */}
      <div className="ws-head fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between px-4 md:hidden">
        <Link href="/" className="ws-display text-base">
          Market <span className="text-accent">Square</span>
        </Link>
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

      <main
        className={cn(
          "ws-hair min-h-dvh min-w-0 flex-1 border-x pt-12 pb-16 md:pt-0 md:pb-0",
          // Home carries the design's wider timeline; the other column
          // surfaces stay at the narrower reading width.
          !wide && (pathname === "/" ? "md:max-w-[720px]" : "md:max-w-[600px]")
        )}
      >
        {children}
      </main>

      {!wide && <RightRail />}

      {/* Mobile compose: a floating silver core, the one elevated control. */}
      <Link
        href="/?compose=1"
        aria-label="Post"
        className="ws-press fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink shadow-[0_4px_24px_rgba(212,212,216,0.3)] md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
      >
        <IconPlus className="h-6 w-6" />
      </Link>

      <MobileBar pathname={pathname} />

      {/* First-load claim-username prompt for freshly created profiles. */}
      <ClaimUsernameGate />
      {/* Session-expiry watchdog: logs out properly instead of half-stuck. */}
      <SessionGuard />
    </div>
  );
}
