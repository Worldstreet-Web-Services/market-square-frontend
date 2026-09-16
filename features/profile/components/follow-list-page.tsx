"use client";

import { useRouter } from "next/navigation";
import { atHandle } from "@/lib/handle";
import { useMe } from "@/hooks/use-me";
import { ColumnHeader, ColumnTabs } from "@/components/layout/column-header";
import { BrowseList } from "@/components/ui/browse-list";
import { ErrorState } from "@/components/ui/states";
import {
  useFollowersList,
  useFollowingList,
  useProfile,
} from "@/features/profile/hooks/use-profile";
import { PersonRow } from "@/features/profile/components/person-row";
import { useCanonicalProfileAddress } from "@/features/profile/hooks/use-canonical-profile-address";
import type { Profile } from "@/lib/api/schemas";

export type FollowListTab = "followers" | "following";

/**
 * WHO FOLLOWS SOMEBODY, AND WHO THEY FOLLOW — X's `/{user}/followers` and
 * `/{user}/following`, as two routes under the profile.
 *
 * TWO ROUTES, NOT ONE PAGE WITH A QUERY STRING. Each list is something a
 * person links to ("look who follows her"), and the tab strip switches
 * between them with `router.replace` so the address always names the list on
 * screen while Back still leaves the page in one step rather than walking
 * back through every tab that was tapped.
 *
 * NOTHING HERE IS NEW UI. The row is `PersonRow` — the one row for listing
 * people, whose own header already named follower lists as its next caller —
 * so follow, wink and block/report behave exactly as they do on Explore. The
 * paging shell is `BrowseList`, so loading, error with retry, empty and the
 * infinite-scroll sentinel are the same six states every other list has.
 *
 * FOLLOW STATE IS THE SERVER'S. Both endpoints hydrate the reader's own edge
 * on every row, so your own Following list reads "Following" down the page
 * with nothing assumed client-side. Signed out, the field is absent and
 * `useIsFollowing` answers "Follow" — never a fabricated "Following".
 *
 * ORDER IS THE SERVICE'S TOO, and it is not yet newest-first: both lists sort
 * by the other profile's id. That is consistent with the id cursor, so paging
 * neither skips nor repeats anybody; it is only an arbitrary order. The fix
 * (follow time, with a cursor that carries it) belongs to the backend and is
 * with it — nothing here re-sorts a page, which would reorder rows as later
 * pages arrived.
 */
export function FollowListPage({ username, tab }: { username: string; tab: FollowListTab }) {
  const router = useRouter();
  const me = useMe();
  const profile = useProfile(username);
  // The same address rule as the profile itself, keeping the list on screen.
  useCanonicalProfileAddress(username, profile.data, tab);
  const id = profile.data?.id;

  // Both hooks run every render; only the list on screen is enabled. A tab
  // visited once stays cached under its key, so switching back is instant.
  const followers = useFollowersList(tab === "followers" ? id : undefined);
  const following = useFollowingList(tab === "following" ? id : undefined);
  const query = tab === "followers" ? followers : following;

  const isMe = Boolean(id) && me.data?.id === id;
  // The canonical handle once the profile has loaded — a link opened by id or
  // by a minted handle still switches tabs under the address people share.
  const handle = profile.data?.username ?? username;
  const items: Profile[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  const header = (
    <ColumnHeader
      title={profile.data?.displayName ?? "Profile"}
      subtitle={atHandle(profile.data?.username) ?? undefined}
      back
      backFallback={`/u/${handle}`}
    >
      <ColumnTabs
        tabs={[
          { value: "followers" as FollowListTab, label: "Followers" },
          { value: "following" as FollowListTab, label: "Following" },
        ]}
        value={tab}
        onChange={(next) => router.replace(`/u/${handle}/${next}`, { scroll: false })}
      />
    </ColumnHeader>
  );

  // The person could not be found or loaded, so there is no id to list by.
  // Said once, in the page's own terms, rather than as an empty list.
  if (profile.isError) {
    return (
      <>
        {header}
        <div className="p-4">
          <ErrorState
            error={profile.error}
            fallback="Couldn't load this profile."
            onRetry={() => profile.refetch()}
          />
        </div>
      </>
    );
  }

  const empty =
    tab === "followers"
      ? {
          title: "No followers yet",
          body: isMe
            ? "When people follow you, they show up here."
            : "When people follow them, they show up here.",
        }
      : {
          title: isMe ? "You don't follow anyone yet" : "Not following anyone yet",
          body: isMe
            ? "People you follow show up here."
            : "When they follow people, those people show up here.",
        };

  return (
    <>
      {header}
      <BrowseList
        // A disabled query is still `pending`, so while the profile loads this
        // draws the same skeleton rows the list will replace — no second
        // loading state, and no layout jump when the id arrives.
        query={query}
        items={items}
        renderItem={(person) => <PersonRow key={person.id} profile={person} />}
        emptyTitle={empty.title}
        emptyBody={empty.body}
        errorFallback={tab === "followers" ? "Couldn't load followers." : "Couldn't load who they follow."}
      />
    </>
  );
}
