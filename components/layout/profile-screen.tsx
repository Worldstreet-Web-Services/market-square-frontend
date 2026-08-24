"use client";

import { useRouter } from "next/navigation";
import { ProfilePage } from "@/features/profile";
import { useOpenConversation } from "@/features/messages";
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

export function ProfileScreen({ username }: { username: string }) {
  return (
    <ProfilePage
      username={username}
      messageSlot={(profile) => <MessageButton profile={profile} />}
    />
  );
}
