"use client";

import { useState } from "react";
import type { Post } from "@/lib/api/schemas";
import { useRouter } from "next/navigation";
import { ProfilePage } from "@/features/profile";
import { ProfileHouses } from "@/components/layout/profile-houses";
import { PostCard, VideoViewer } from "@/features/feed";
import { useOpenConversation } from "@/features/messages";
import { ComposeSheet } from "@/components/layout/compose-sheet";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/api/schemas";

/**
 * Joins the profile and messages slices, which never import each other.
 *
 * Opening a conversation is idempotent on the service, so this is safe to hit
 * repeatedly — it lands on the existing thread when there is one.
 */
function MessageButton({ profile }: { profile: Profile }) {
  const open = useOpenConversation();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={open.isPending}
      onClick={() => open.mutate(profile.id, { onSuccess: () => router.push("/messages") })}
    >
      Message
    </Button>
  );
}

/**
 * The "you have no posts yet" CTA on your own profile.
 *
 * It used to link to `/?compose=1`, which threw you off your profile to write
 * a post. Same rule as the shell's compose controls: open it where you stand.
 * The composer lives in the feed slice, so it is joined here rather than
 * imported by profile.
 */
function ComposeCta() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ws-press inline-flex rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
      >
        Create a post
      </button>
      <ComposeSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Holds the active slide, so sliding changes which item is open. */
function ProfileMediaViewer({
  items,
  openId,
  onClose,
}: {
  items: Post[];
  openId: string;
  onClose: () => void;
}) {
  const [activeId, setActiveId] = useState(openId);
  return (
    <VideoViewer
      items={items}
      activeId={activeId}
      onActiveChange={setActiveId}
      onClose={onClose}
    />
  );
}

export function ProfileScreen({ username }: { username: string }) {
  return (
    <ProfilePage
      username={username}
      messageSlot={(profile) => <MessageButton profile={profile} />}
      /* 534:15577 — a house is a group CONVERSATION, so the rail reads the
         messages slice and is joined here rather than imported across. */
      housesSlot={<ProfileHouses />}
      composeSlot={<ComposeCta />}
      // The same card the timeline and Explore render. The profile used to
      // draw its own stripped row, whose heart was a <span> with no handler,
      // so a like from a profile silently did nothing.
      postSlot={(post) => <PostCard post={post} />}
      /*
        The same full-screen viewer the timeline promotes a video into,
        composed in here because profile never imports the feed slice. It is
        given the gallery in grid order, so sliding moves through exactly what
        was on screen — which is the whole point of "go to their profile and
        slide".
      */
      mediaViewerSlot={(items, openId, onClose) => (
        <ProfileMediaViewer items={items} openId={openId} onClose={onClose} />
      )}
    />
  );
}
