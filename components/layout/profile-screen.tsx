"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProfilePage } from "@/features/profile";
import { PostCard } from "@/features/feed";
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

export function ProfileScreen({ username }: { username: string }) {
  return (
    <ProfilePage
      username={username}
      messageSlot={(profile) => <MessageButton profile={profile} />}
      composeSlot={<ComposeCta />}
      // The same card the timeline and Explore render. The profile used to
      // draw its own stripped row, whose heart was a <span> with no handler,
      // so a like from a profile silently did nothing.
      postSlot={(post) => <PostCard post={post} />}
    />
  );
}
