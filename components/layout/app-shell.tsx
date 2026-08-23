"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { useBroadcastStatus } from "@/hooks/use-broadcast-status";
import { useLogout } from "@/hooks/use-logout";
import { ClaimUsernameGate } from "@/features/profile";
import { SessionGuard } from "@/components/layout/session-guard";
import { Avatar } from "@/components/ui/avatar";
import {
  IconCalendar,
  IconCamera,
  IconHome,
  IconLive,
  IconSpark,
  IconStore,
  IconTicket,
  IconUser,
} from "@/components/ui/icons";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  authed?: boolean;
}

// Desktop icon rail: everything; mobile tab bar: the consumer five with the
// elevated Go Live button in the middle.
const RAIL: NavItem[] = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/live", label: "Live", icon: IconLive },
  { href: "/store", label: "Store", icon: IconStore },
  { href: "/spotlight", label: "Spotlight", icon: IconSpark },
  { href: "/schedule", label: "Schedule", icon: IconCalendar, authed: true },
  { href: "/tickets", label: "Tickets", icon: IconTicket, authed: true },
  { href: "/studio", label: "Studio", icon: IconCamera, authed: true },
];

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

function RailProfile() {
  const { ready, authenticated, login } = useAuth();
  const me = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!ready) return <div className="ws-skeleton h-10 w-10 rounded-full" />;
  if (!authenticated) {
    return (
      <button
        onClick={login}
        aria-label="Sign in"
        title="Sign in"
        className="ws-press flex h-10 w-10 items-center justify-center rounded-full bg-accent text-ink"
      >
        <IconUser className="h-5 w-5" />
      </button>
    );
  }
  const href = me.data ? `/u/${me.data.username}` : "/auth";
  const active = me.data ? isActive(pathname, `/u/${me.data.username}`) : false;
  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={menuOpen}
        title={me.data?.displayName ?? "My profile"}
        className={cn(
          "ws-press rounded-full",
          active && "ring-2 ring-accent ring-offset-2 ring-offset-black"
        )}
      >
        <Avatar name={me.data?.displayName ?? "Me"} src={me.data?.avatarUrl} size={36} />
      </button>
      {menuOpen && (
        <>
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="ws-overlay absolute bottom-0 left-full z-20 ml-2 w-44 rounded-2xl p-1.5">
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push(href);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-grey-200 transition-colors hover:bg-white/10"
            >
              View profile
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                void logout();
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-down transition-colors hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MobileProfileTab() {
  const { ready, authenticated } = useAuth();
  const router = useRouter();
  const me = useMe();
  const pathname = usePathname();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = me.data ? isActive(pathname, `/u/${me.data.username}`) : false;
  const href = !ready || !authenticated ? "/auth" : me.data ? `/u/${me.data.username}` : "/auth";

  if (!authenticated) {
    return (
      <button
        onClick={() => router.push("/auth")}
        aria-label="Sign in"
        className="ws-press flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full text-meta"
      >
        <IconUser className="h-5 w-5" />
        <span className="text-[9px] font-semibold">Sign in</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Profile menu"
        aria-expanded={menuOpen}
        className={cn(
          "ws-press flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full",
          active ? "text-heading" : "text-meta"
        )}
      >
        <IconUser className="h-5 w-5" />
        <span className="text-[9px] font-semibold">You</span>
      </button>
      {menuOpen && (
        <>
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="ws-overlay absolute bottom-14 right-0 z-20 w-44 rounded-2xl p-1.5">
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push(href);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-grey-200 transition-colors hover:bg-white/10"
            >
              View profile
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                void logout();
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-down transition-colors hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { authenticated } = useAuth();
  const broadcast = useBroadcastStatus();

  // The stream room owns its whole viewport; the shell stays out of the way
  // there (no tab bar over the player, no top bar).
  const inRoom = /^\/live\/[^/]+$/.test(pathname);

  const mobileTabs: Array<NavItem> = [
    { href: "/", label: "Home", icon: IconHome },
    { href: "/live", label: "Live", icon: IconLive },
  ];
  const mobileTabsRight: Array<NavItem> = [{ href: "/store", label: "Store", icon: IconStore }];

  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop: slim glass-free icon rail. Depth from surface, not a box. */}
      <aside className="sticky top-0 z-40 hidden h-dvh w-[68px] shrink-0 flex-col items-center gap-1 border-r border-white/8 py-5 md:flex">
        <Link
          href="/"
          className="ws-display ws-press mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-base text-ink"
          aria-label="Market Square home"
          title="Market Square"
        >
          M
        </Link>
        {RAIL.filter((item) => !item.authed || authenticated).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "ws-press group relative flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                active ? "bg-white/10 text-accent" : "text-meta hover:bg-white/5 hover:text-body"
              )}
            >
              <item.icon className="h-5 w-5" />
              {/* tooltip */}
              <span className="ws-overlay pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-body group-hover:block group-focus-visible:block">
                {item.label}
              </span>
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-3">
          {broadcast.live && <OnAirPill streamId={broadcast.streamId} compact />}
          <RailProfile />
        </div>
      </aside>

      {/* Mobile top wordmark strip (hidden in the stream room). */}
      {!inRoom && (
        <div className="fixed inset-x-0 top-0 z-40 flex h-11 items-center justify-between px-4 md:hidden">
          <Link href="/" className="ws-display relative text-base">
            Market <span className="text-accent">Square</span>
          </Link>
          <div className="flex items-center gap-3">
            {broadcast.live && <OnAirPill streamId={broadcast.streamId} compact />}
            <Link href="/spotlight" className="text-meta" aria-label="Spotlight">
              <IconSpark className="h-5 w-5" />
            </Link>
          </div>
        </div>
      )}

      <main className={cn("min-w-0 flex-1", !inRoom && "pt-11 pb-24 md:pt-0 md:pb-0")}>
        {children}
      </main>

      {/* Mobile: floating glass pill tab bar with the elevated Go Live core. */}
      {!inRoom && (
        <nav
          className="fixed inset-x-4 z-40 md:hidden"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          aria-label="Primary"
        >
          <div className="ws-glass flex items-center justify-around rounded-full px-3 py-1.5">
            {mobileTabs.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className={cn(
                    "ws-press flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full",
                    active ? "text-heading" : "text-meta"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[9px] font-semibold">{item.label}</span>
                </Link>
              );
            })}
            {/* Go Live: elevated silver circle. */}
            <Link
              href="/studio"
              aria-label="Go live"
              className="ws-press -mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink shadow-[0_4px_24px_rgba(212,212,216,0.35)]"
            >
              <IconCamera className="h-6 w-6" />
            </Link>
            {mobileTabsRight.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className={cn(
                    "ws-press flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full",
                    active ? "text-heading" : "text-meta"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[9px] font-semibold">{item.label}</span>
                </Link>
              );
            })}
            <MobileProfileTab />
          </div>
        </nav>
      )}

      {/* First-load claim-username prompt for freshly created profiles. */}
      <ClaimUsernameGate />
      {/* Session-expiry watchdog: logs out properly instead of half-stuck. */}
      <SessionGuard />
    </div>
  );
}
