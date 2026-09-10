"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { PostCard } from "@/features/feed/components/post-card";
import { usePost } from "@/features/feed/hooks/use-feed";
import { IconX } from "@/components/ui/icons";
import { ANNOUNCEMENT_KEY, shouldShowAnnouncement } from "@/lib/announcement";
import type { Profile } from "@/lib/api/schemas";

/**
 * THE PINNED ANNOUNCEMENT, above the timeline.
 *
 * One post, held at the top of Home for everybody, signed in or not. See
 * `lib/announcement.ts` for why the id is server config rather than a
 * constant, and why dismissal stores WHICH post was dismissed instead of a
 * boolean.
 *
 * ─── IT IS THE ORDINARY POST CARD ───────────────────────────────────────────
 * Not a bespoke banner. The announcement is a real post, so it renders with
 * `PostCard` and keeps everything that comes with one: the author's identity
 * and chips, working `@mentions`, a permalink, replies, and the ability to
 * quote it. A notice nobody can reply to reads like paper taped to a wall,
 * and a second card implementation is a second place every future post fix
 * has to be made.
 *
 * What marks it as an announcement is the strip above it, not a different
 * card — so the eye gets the signal and the object stays the same thing.
 *
 * ─── EVERY FAILURE RENDERS NOTHING ──────────────────────────────────────────
 * No id configured, the fetch still in flight, the post deleted or 404, the
 * reader dismissed it: all of them return null. An announcement is furniture
 * the page is fine without, so it must never show a skeleton, an error, or an
 * empty slab where a post should be — the reader has no idea anything was
 * supposed to be there, and telling them is worse than silence.
 */

/* ── Which announcement this reader has already closed ─────────────────────
   The same module-level `useSyncExternalStore` shape the stories rail and the
   welcome gate use: no context, no store library (CLAUDE.md forbids a global
   state manager). Every storage access is try/caught, because a private
   window throws on the property itself rather than returning null. */
let cache: string | null | undefined;
const listeners = new Set<() => void>();

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(ANNOUNCEMENT_KEY);
  } catch {
    // Storage unavailable. Treat it as "nothing dismissed" so the notice still
    // shows — failing OPEN is right for an announcement, where the cost of
    // showing it twice is far below the cost of never showing it.
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => (cache === undefined ? (cache = readDismissed()) : cache);
/* Server snapshot is "nothing dismissed", matching the client's first paint on
   a fresh browser. It is the honest default: the alternative — claiming it was
   dismissed — would hide the notice for one frame on every load. */
const getServerSnapshot = () => null;

function dismiss(postId: string) {
  try {
    window.localStorage.setItem(ANNOUNCEMENT_KEY, postId);
  } catch {
    /* Unavailable: it comes back next visit. Not worth an error. */
  }
  cache = postId;
  for (const listener of listeners) listener();
}

export function Announcement({
  followSlot,
}: {
  followSlot?: (author: Profile) => React.ReactNode;
}) {
  /* The id, from the server so it can change without a rebuild. Its own query
     rather than a prop, because Home is not the only surface that might carry
     this later and the answer is shared and cacheable. */
  const configured = useQuery({
    queryKey: ["ms", "announcement"],
    queryFn: async (): Promise<string | null> => {
      const response = await fetch("/api/announcement");
      if (!response.ok) return null;
      const body = (await response.json()) as { postId?: string | null };
      return body.postId ?? null;
    },
    staleTime: 60_000,
  });

  const postId = configured.data ?? null;
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const show = shouldShowAnnouncement(postId, dismissed);

  /* `usePost` is the SAME cache entry the permalink uses, so opening the
     announcement is instant and a like made here lands there. Disabled until
     it is actually going to be shown — a dismissed announcement must not cost
     a request on every page load. */
  const post = usePost(show ? postId! : "");
  const onDismiss = useCallback(() => postId && dismiss(postId), [postId]);

  /*
    A REMOVED POST IS NOT AN ANNOUNCEMENT, and neither is one that 404s.

    The id is config, so it outlives the post it names: delete the post, or
    have it moderated away, and a naive read renders a ghost — or an error
    banner above every timeline, for signed-out visitors too. "Not found or
    not active" is the SAME answer as "nothing pinned", which is also what
    `GET /announcement` will answer when the route lands, so the client's
    behaviour will not change when it does.
  */
  /*
    AN UNSIGNED ANNOUNCEMENT IS WORSE THAN NO ANNOUNCEMENT, so `author` is a
    hard requirement rather than a nicety.

    `GET /posts/:id` does NOT hydrate the author today — it returns `authorId`
    and nothing else, while `/feed` returns the whole profile. PostCard's
    fallback for that is an avatar with the name "?" and no handle at all,
    which is exactly what the permalink for this post currently renders.

    For an ordinary post that is a blemish. For the FIRST use of this surface
    — a notice telling people which accounts are official and that support
    will never DM them — a card that cannot say who sent it argues against
    itself. So it stays hidden until the author is there, and lights up on its
    own the moment the service hydrates it. Requested from the backend.
  */
  if (!show || !post.data || post.data.status !== "active" || !post.data.author) return null;

  return (
    <section aria-label="Announcement" className="ws-enter">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <span className="text-[13px] font-semibold tracking-[-0.01em] text-create">
          Announcement
        </span>
        {/* Dismissible, and the hit area is a real 32px rather than the 16px
            glyph — this sits at the top of the page under a thumb. */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss announcement"
          className="ws-press -mr-1 flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
      <PostCard post={post.data} followSlot={followSlot} />
    </section>
  );
}
