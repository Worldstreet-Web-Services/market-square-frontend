"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import { invalidateIdentitySurfaces } from "@/lib/api/invalidate";
import { trackMarketEvent } from "@/lib/analytics";
import type { Profile } from "@/lib/api/schemas";
import { useAuth } from "@/hooks/use-auth";
import { clearFollowIntent, setFollowIntent } from "@/features/profile/lib/follow-state";
import {
  applyForCreator,
  fetchCreatorApplication,
  fetchMyVerification,
  fetchProfile,
  fetchProfileActivities,
  fetchProfilePosts,
  fetchProfileStreams,
  fetchSpotlight,
  fetchVerificationRule,
  renewVerification,
  reportProfile,
  setBlocked,
  setFollow,
  updateMe,
} from "@/features/profile/lib/api";


export function useProfile(username: string) {
  return useQuery({
    queryKey: ["ms", "profile", username],
    queryFn: () => fetchProfile(username),
  });
}

/**
 * Report and block.
 *
 * `POST|DELETE /profiles/:id/block` ships on the backend's own cadence; until
 * it lands the call 404s. A 404 here is "not deployed", not "your block
 * failed" — so the control goes quiet and says so, exactly the way Arkmarks
 * does, rather than toasting a success that never reached the service. Any
 * other failure is a real failure and is reported as one; nothing about this
 * flow may end in a success toast without a 2xx behind it.
 */
export function useProfileSafety(profile: Profile) {
  const queryClient = useQueryClient();
  const [blockUnavailable, setBlockUnavailable] = useState(false);
  const block = useMutation({
    mutationFn: (blocked: boolean) => setBlocked(profile.id, blocked),
    onSuccess: (_, blocked) => {
      queryClient.setQueryData<Profile>(["ms", "profile", profile.username], (old) => old ? { ...old, isBlocked: blocked, isFollowing: blocked ? false : old.isFollowing } : old);
      // Blocking hides their posts and drops the follow edge, so every list
      // that could carry either has to come back from the server.
      queryClient.invalidateQueries({ queryKey: ["ms", "feed"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "stories"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "profile-posts", profile.username] });
      queryClient.invalidateQueries({ queryKey: ["ms", "spotlight"] });
      toast.success(blocked ? "Profile blocked" : "Profile unblocked");
    },
    onError: (error) => {
      if (errorCode(error) === "NOT_FOUND") {
        setBlockUnavailable(true);
        toast.error("Blocking isn't available yet.");
        return;
      }
      toast.error(errorMessage(error, "Couldn't update the block."));
    },
  });
  const report = useMutation({
    mutationFn: () => reportProfile(profile.id),
    onSuccess: () => toast.success("Report sent for review"),
    onError: (error) => toast.error(errorMessage(error, "Couldn't send the report.")),
  });
  return { block, blockUnavailable, report };
}

export function useProfilePosts(username: string) {
  return useQuery({
    queryKey: ["ms", "profile-posts", username],
    queryFn: () => fetchProfilePosts(username),
  });
}

export function useProfileStreams(username: string) {
  return useQuery({
    queryKey: ["ms", "profile-streams", username],
    queryFn: () => fetchProfileStreams(username),
  });
}

export function useProfileActivities(username: string) {
  return useQuery({
    queryKey: ["ms", "profile-activities", username],
    queryFn: () => fetchProfileActivities(username),
  });
}

/**
 * Optimistic follow: flip the button and count immediately, roll back on error.
 *
 * The profile query is patched directly, but the rails (spotlight,
 * who-to-follow) render from list payloads that may not carry `isFollowing`
 * at all — patching those would be patching a field the server then drops on
 * the next refetch. So the durable half of the optimism is the follow intent
 * in `follow-state.ts`, which the controls read through `useIsFollowing`.
 */
export function useFollow(profile: Profile) {
  const queryClient = useQueryClient();

  const apply = (following: boolean) => {
    setFollowIntent(profile.id, following);
    queryClient.setQueryData<Profile>(["ms", "profile", profile.username], (old) =>
      old
        ? {
            ...old,
            isFollowing: following,
            followerCount: Math.max(0, old.followerCount + (following ? 1 : -1)),
          }
        : old
    );
  };

  return useMutation({
    mutationFn: (follow: boolean) => setFollow(profile.id, follow),
    onMutate: (follow) => apply(follow),
    onError: (error, follow) => {
      apply(!follow);
      // A failed follow leaves no intent behind at all: `apply(!follow)` only
      // restores the opposite guess, and guessing is exactly what must not
      // survive an error.
      clearFollowIntent(profile.id);
      toast.error(errorMessage(error, "Couldn't update follow."));
    },
    onSettled: () => {
      // The followed profile owns follower counts; MY profile owns the
      // following count; the spotlight and who-to-follow rails both render
      // from ["ms","spotlight"]; search results carry `isFollowing`; and the
      // Following lane plus the stories rail change membership outright.
      queryClient.invalidateQueries({ queryKey: ["ms", "profile", profile.username] });
      queryClient.invalidateQueries({ queryKey: ["ms", "me"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "feed", "following"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "stories"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "spotlight"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "discovery"] });
    },
    onSuccess: () => {
      trackMarketEvent("follow_created", { surface: "profile", entityType: "profile", entityId: profile.id });
    },
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMe,
    onSuccess: (me) => {
      queryClient.setQueryData(["ms", "me"], me);
      queryClient.setQueryData(["ms", "profile", me.username], me);
      // A rename, a new avatar or a claimed username changes the identity that
      // is stamped into every cached list, not just the profile page.
      invalidateIdentitySurfaces(queryClient);
      toast.success("Profile updated");
    },
  });
}

export function useVerificationRule() {
  return useQuery({
    queryKey: ["ms", "verification-rule"],
    queryFn: fetchVerificationRule,
    staleTime: 5 * 60_000,
  });
}

export function useMyVerification() {
  const { ready, authenticated } = useAuth();
  return useQuery({
    queryKey: ["ms", "my-verification"],
    queryFn: fetchMyVerification,
    enabled: ready && authenticated,
  });
}

/**
 * Renew or restore the badge.
 *
 * On success the profile itself changes (lapsed → verified flips the check
 * everywhere), so this invalidates the profile tree as well as the billing
 * view. Failures are surfaced inline by the card rather than as a toast —
 * PAYMENT_FAILED needs to sit next to the button that caused it.
 */
export function useRenewVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: renewVerification,
    onSuccess: (data) => {
      queryClient.setQueryData(["ms", "my-verification"], data);
      queryClient.invalidateQueries({ queryKey: ["ms", "my-verification"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "me"] });
      // The silver check is drawn from the author copy embedded in every feed
      // item, story and search row — not from the profile query.
      invalidateIdentitySurfaces(queryClient);
      toast.success("Verification renewed");
    },
  });
}

export function useSpotlight() {
  return useQuery({
    queryKey: ["ms", "spotlight", "weekly"],
    queryFn: fetchSpotlight,
  });
}

export function useCreatorApplication() {
  const { ready, authenticated } = useAuth();
  return useQuery({
    queryKey: ["ms", "creator-application"],
    queryFn: fetchCreatorApplication,
    enabled: ready && authenticated,
  });
}

export function useApplyCreator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => applyForCreator(note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "creator-application"] });
      // Approval flips the role chip; refresh the identity the shell shows.
      queryClient.invalidateQueries({ queryKey: ["ms", "me"] });
      toast.success("Application sent — we'll review it shortly.");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't send the application.")),
  });
}
