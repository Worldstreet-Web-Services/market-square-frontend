"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { atHandle } from "@/lib/handle";
import { sq } from "@/lib/square-path";
import { usePost } from "@/features/feed";
import { GistRoomCard } from "@/components/layout/gist-room-card";
import { useProfile } from "@/features/profile";
import type { SquareRef } from "@/lib/square-link";

/**
 * A SQUARE LINK, DRAWN AS THE THING IT POINTS AT.
 *
 * ogazboiz asked for X's behaviour: share a link, post it as a normal post,
 * and have it arrive as something you can recognise without following it. A
 * post that reads `https://square.tsionark.com/p/034OqIAD…` tells the reader
 * nothing; the same post with a card tells them whose post it is and what it
 * says.
 *
 * ─── IT NEVER INVENTS WHAT IT CANNOT LOAD ────────────────────────────────────
 * The card renders from the SERVICE's own answer for that post or profile, and
 * while that answer is in flight it draws a quiet placeholder of the right
 * shape rather than a guess. If the thing is gone, or private, or the request
 * fails, the card removes itself and the link stays as a link — the reader
 * ends up exactly where they were before this feature existed, which is the
 * only honest failure for a preview.
 *
 * ─── AND IT IS NOT A SECOND POST ─────────────────────────────────────────────
 * Quieter than the post that contains it: one line of name, two of text, no
 * actions. A preview that carries its own like and reply controls competes
 * with the thing somebody actually wrote, and turns every share into a
 * miniature feed.
 */
export function SharedLinkCard({ reference, href }: { reference: SquareRef; href: string }) {
  if (reference.kind === "post") return <PostPreview id={reference.id} href={href} />;
  if (reference.kind === "profile") return <ProfilePreview username={reference.id} href={href} />;
  /*
    A ROOM GETS THE ROOM'S OWN CARD — the one the messages pane already draws,
    which is the point: a gist room shared into the feed and the same room
    announced in a house should not be two different objects (ogazboiz,
    2026-09-21: "the share link I mean is like posting to Square for gist
    room").

    It carries the room's LIVE state — live, not open yet, or ended — so a post
    from this morning stops offering to join a room that closed at noon, which
    a hand-rolled preview would happily go on doing. There is no conversation
    behind a feed post, so the two member faces are simply absent.
  */
  return (
    <span className="mt-2 block" data-shared-link={href}>
      <GistRoomCard streamId={reference.id} fluid />
    </span>
  );
}

const SHELL =
  "mt-2 block overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.06]";

function PostPreview({ id, href }: { id: string; href: string }) {
  const post = usePost(id);

  if (post.isPending) return <Skeleton />;
  // Gone, private, or the request failed: the link stays a link.
  if (!post.data) return null;

  const author = post.data.author;
  const name = author?.displayName || author?.username || "Someone";
  return (
    <Link href={sq(`/p/${id}`)} onClick={(event) => event.stopPropagation()} className={SHELL} data-shared-link={href}>
      <span className="flex items-center gap-2">
        <Avatar name={name} seed={author?.id ?? id} src={author?.avatarUrl ?? null} size={20} />
        <span className="truncate text-[12px] font-semibold text-white/90">{name}</span>
        {/* `atHandle` refuses to print a raw id as a handle: a profile whose
            username is still their Privy did would otherwise read as
            "@did:privy:…" under their own face. */}
        {atHandle(author?.username) && (
          <span className="truncate text-[11px] text-white/45">{atHandle(author?.username)}</span>
        )}
      </span>
      {post.data.text && (
        <span className="mt-1 line-clamp-2 block text-[12px] leading-[17px] text-white/70">
          {post.data.text}
        </span>
      )}
    </Link>
  );
}

function ProfilePreview({ username, href }: { username: string; href: string }) {
  const profile = useProfile(username);

  if (profile.isPending) return <Skeleton />;
  if (!profile.data) return null;

  const person = profile.data;
  return (
    <Link
      href={sq(`/u/${username}`)} prefetch={false}
      onClick={(event) => event.stopPropagation()}
      className={SHELL}
      data-shared-link={href}
    >
      <span className="flex items-center gap-2.5">
        <Avatar name={person.displayName || username} seed={person.id} src={person.avatarUrl} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-white/90">
            {person.displayName || username}
          </span>
          <span className="block truncate text-[11px] text-white/45">{atHandle(username)}</span>
        </span>
      </span>
      {person.bio && (
        <span className="mt-1.5 line-clamp-2 block text-[12px] leading-[17px] text-white/70">
          {person.bio}
        </span>
      )}
    </Link>
  );
}

/** The card's own footprint while the service answers, so the feed does not jump. */
function Skeleton() {
  return (
    <span className={cn(SHELL, "pointer-events-none block")} aria-hidden>
      <span className="ws-skeleton block h-3 w-28 rounded" />
      <span className="ws-skeleton mt-2 block h-3 w-full rounded" />
    </span>
  );
}
