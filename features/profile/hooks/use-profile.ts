"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import { trackMarketEvent } from "@/lib/analytics";
import type { Profile } from "@/lib/api/schemas";
import { useAuth } from "@/hooks/use-auth";
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

// Optimistic follow: flip the button and count immediately, roll back on error.
export function useFollow(profile: Profile) {
  const queryClient = useQueryClient();

  const apply = (following: boolean) => {
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
      toast.error(errorMessage(error, "Couldn't update follow."));
    },
    onSuccess: () => {
      trackMarketEvent("follow_created", { surface: "profile", entityType: "profile", entityId: profile.id });
      queryClient.invalidateQueries({ queryKey: ["ms", "feed", "following"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "stories"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "spotlight"] });
    },
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMe,
    onSuccess: (me) => {
      queryClient.setQueryData(["ms", "me"], me);
      queryClient.invalidateQueries({ queryKey: ["ms", "profile", me.username] });
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
      queryClient.invalidateQueries({ queryKey: ["ms", "profile"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "me"] });
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
      toast.success("Application sent — we'll review it shortly.");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't send the application.")),
  });
}
