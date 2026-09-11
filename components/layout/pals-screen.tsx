"use client";

import { useState } from "react";
import { ColumnTabs } from "@/components/layout/column-header";
import { FriendsDeck } from "@/components/layout/friends-deck";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, SignInPrompt } from "@/components/ui/states";
import { StoriesRow } from "@/features/feed";
import { PersonRow, useFollowingList, useMyWinks } from "@/features/profile";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { errorCode } from "@/lib/api/envelope";
import type { Profile } from "@/lib/api/schemas";

/**
 * THE PALS SURFACE — where people are met, now that Discover has left the dock.
 *
 * The stories strip opens it (it left Home for here), and right under it a tab
 * row: DISCOVER is the people deck one person at a time, WINKS is who winked
 * at you (`GET /me/winks`), FOLLOWING is who you follow. The deck is the SAME
 * `FriendsDeck` the timeline used to carry, not a second copy; the two lists
 * are `PersonRow`, the app's one people row, so follow behaves the same
 * everywhere.
 */

type PalsTab = "discover" | "winks" | "following";

const TABS: Array<{ value: PalsTab; label: string }> = [
  { value: "discover", label: "Discover" },
  { value: "winks", label: "Winks" },
  { value: "following", label: "Following" },
];

function PeopleList({
  query,
  people,
  emptyTitle,
  emptyBody,
  unavailableTitle,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
  };
  people: Profile[];
  emptyTitle: string;
  emptyBody: string;
  unavailableTitle: string;
}) {
  if (query.isPending) return <>{[0, 1, 2].map((index) => <RowSkeleton key={index} />)}</>;
  if (query.isError) {
    return errorCode(query.error) === "NOT_FOUND" ? (
      <EmptyState title={unavailableTitle} body="It's coming soon." />
    ) : (
      <ErrorState error={query.error} fallback="Couldn't load this list." onRetry={() => void query.refetch()} />
    );
  }
  if (people.length === 0) return <EmptyState title={emptyTitle} body={emptyBody} />;
  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {people.map((profile) => (
          <li key={profile.id}>
            <PersonRow profile={profile} />
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="self-start px-1 py-3 text-[13px] font-semibold text-meta transition-colors hover:text-heading disabled:opacity-40"
        >
          {query.isFetchingNextPage ? "Loading…" : "Show more"}
        </button>
      )}
    </div>
  );
}

function WinksTab() {
  const winks = useMyWinks(true);
  const people = winks.data?.pages.flatMap((page) => page.items.map((item) => item.profile)) ?? [];
  return (
    <PeopleList
      query={winks}
      people={people}
      emptyTitle="No winks yet"
      emptyBody="When someone winks at you, they show up here."
      unavailableTitle="Winks aren't available here yet"
    />
  );
}

function FollowingTab() {
  const me = useMe();
  const following = useFollowingList(me.data?.id);
  const people = following.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <PeopleList
      query={{ ...following, isPending: following.isPending || !me.data }}
      people={people}
      emptyTitle="You're not following anyone yet"
      emptyBody="Follow people from Discover and they show up here."
      unavailableTitle="Following isn't available here yet"
    />
  );
}

export function PalsScreen() {
  // The strip and the two lists are about YOU, so they need somebody signed in.
  const { authenticated } = useAuth();
  const [tab, setTab] = useState<PalsTab>("discover");

  return (
    <div className="flex min-h-[calc(100dvh-var(--ws-crumb-h)-var(--ws-topbar-h)-var(--ws-nav-h))] flex-col gap-6 px-4 py-6 md:gap-8 lg:px-6">
      {authenticated && <StoriesRow />}

      <div className="ws-hair -mx-4 border-b lg:-mx-6">
        <ColumnTabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "discover" && <FriendsDeck heading="pals" />}
      {tab !== "discover" &&
        (authenticated ? (
          tab === "winks" ? <WinksTab /> : <FollowingTab />
        ) : (
          <SignInPrompt
            title={tab === "winks" ? "Sign in to see your winks" : "Sign in to see who you follow"}
            body="Your pals live here once you're signed in."
          />
        ))}
    </div>
  );
}
