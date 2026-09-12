"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, InlineError } from "@/components/ui/states";
import { useDiscovery } from "@/features/discovery";
import { PersonRow } from "@/features/profile";
import { housePath } from "@/features/houses";
import { groupRoomCode, looksLikeRoomCode } from "@/lib/room-code";

/**
 * WHAT HOME'S FIELD ANSWERS — on Home, not somewhere else.
 *
 * The field used to be a link into Explore. ogazboiz asked for the opposite:
 * "everything that i am searching for suppose to be there even room codes ...
 * in that home that search there". So the query is answered in place, and the
 * sections it replaces come back the moment the field is empty.
 *
 * ─── A ROOM CODE IS A DESTINATION, NOT A QUERY ──────────────────────────────
 * A spoken code is the one thing here that names exactly one room, so it is
 * offered FIRST and on its own — searching the text of `f5cptdch4` would
 * match nothing and the reader would conclude the code was wrong. That is
 * what `looksLikeRoomCode` is for, and it only ever picks a DESTINATION: a
 * false answer is not a rejection, it just means the words go to search,
 * which is the right home for a name.
 *
 * The code row is offered rather than followed. Jumping automatically would
 * take somebody out of Home on a keystroke, and a mistyped code that happens
 * to be well-formed would move them somewhere they never asked to go.
 *
 * ─── EVERY KIND, IN ONE LIST ────────────────────────────────────────────────
 * `?type=all`, so people, rooms, posts and products all answer — "everything"
 * was the ask. Each kind keeps the component that already draws it rather
 * than getting a second styling here; a person is a `PersonRow` exactly as
 * they are in Explore, followers lists and search results everywhere else.
 */
export function HomeSearch({ query }: { query: string }) {
  const trimmed = query.trim();
  const bareCode = trimmed.toLowerCase().replace(/[\s-]/g, "");
  const code = looksLikeRoomCode(trimmed) ? bareCode : null;

  const search = useDiscovery(trimmed, "all");
  const items = search.data?.pages.flatMap((page) => page.items) ?? [];
  const people = items.flatMap((item) => (item.kind === "profile" ? [item] : []));
  const rooms = items.flatMap((item) => (item.kind === "stream" ? [item] : []));
  const posts = items.flatMap((item) => (item.kind === "post" ? [item] : []));
  const products = items.flatMap((item) => (item.kind === "product" ? [item] : []));

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* The one result that names exactly one room. */}
      {code && (
        <Link
          href={`/code/${code}`}
          className="ws-card ws-press flex items-center gap-3 p-4"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(90deg,#9F65FD_0%,#5B05E6_100%)] text-[15px] font-bold text-white">
            #
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-white">Open this room</span>
            <span className="tnum block text-[13px] tracking-[0.08em] text-meta">
              {groupRoomCode(bareCode)}
            </span>
          </span>
        </Link>
      )}

      {search.isPending && (
        <div className="flex flex-col gap-2">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}

      {search.isError && <InlineError error={search.error} fallback="That search didn't load." />}

      {!search.isPending && !search.isError && items.length === 0 && !code && (
        <EmptyState
          title="Nothing matched"
          body={`No people, rooms, posts or products for "${trimmed}".`}
        />
      )}

      {people.length > 0 && (
        <Section title="People">
          {people.map((item) => (
            <PersonRow key={item.id} profile={item.profile} />
          ))}
        </Section>
      )}

      {rooms.length > 0 && (
        <Section title="Gist rooms">
          {rooms.map((item) => (
            <Link
              key={item.id}
              href={housePath(item.stream.id)}
              className="ws-row ws-press flex items-center gap-3 px-1 py-3"
            >
              <Avatar
                name={item.stream.title}
                seed={item.stream.id}
                src={item.stream.thumbnailUrl}
                size={38}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-white">
                  {item.stream.title}
                </span>
                {item.stream.owner && (
                  <span className="block truncate text-[13px] text-meta">
                    {item.stream.owner.displayName || item.stream.owner.username}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </Section>
      )}

      {posts.length > 0 && (
        <Section title="Posts">
          {posts.map((item) => (
            <Link
              key={item.id}
              href={`/p/${item.post.id}`}
              className="ws-row ws-press block px-1 py-3"
            >
              <span className="block text-[13px] text-meta">
                {item.post.author
                  ? `@${item.post.author.username}`
                  : "A post"}
              </span>
              <span className="mt-1 line-clamp-2 block text-[15px] text-white">
                {item.post.text || "A post with no words"}
              </span>
            </Link>
          ))}
        </Section>
      )}

      {products.length > 0 && (
        <Section title="ARK Store">
          {products.map((item) => (
            <Link
              key={item.id}
              href={`/store/${item.product.slug}`}
              className="ws-row ws-press flex items-center gap-3 px-1 py-3"
            >
              <Avatar
                name={item.product.name}
                seed={item.product.id}
                src={item.product.thumbnailUrl}
                size={38}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-white">
                  {item.product.name}
                </span>
                {item.product.tagline && (
                  <span className="block truncate text-[13px] text-meta">{item.product.tagline}</span>
                )}
              </span>
            </Link>
          ))}
        </Section>
      )}

      {/* One page is plenty for a field somebody is typing into; the full
          paged lists are Explore's job, and the reader is one tap away. */}
      {search.hasNextPage && (
        <button
          type="button"
          onClick={() => void search.fetchNextPage()}
          disabled={search.isFetchingNextPage}
          className="ws-press mx-auto rounded-full border border-white/15 px-4 py-2 text-[13px] text-meta"
        >
          {search.isFetchingNextPage ? "Loading…" : "Show more results"}
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-meta">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}
