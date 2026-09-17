"use client";

import { IconFlag, IconShield, IconVolume } from "@/components/ui/icons";
import { useGate } from "@/hooks/use-gate";
import { useProfile, useProfileSafety } from "@/features/profile/hooks/use-profile";
import { FollowPill } from "@/features/profile/components/follow-pill";
import type { Profile } from "@/lib/api/schemas";

/**
 * Mute · Block · Report, as three rows.
 *
 * Exists so a surface in another slice — the person sheet in a house — can
 * offer the safety actions without importing this slice. Slices never import
 * each other; the composition happens in `components/layout/`.
 *
 * The ORDER is the point. "Mute for me" is first because in a room of twelve
 * people blocking is a public act with a social cost: the blocked person can
 * tell, so people do not do it and eat the harassment instead. A silence that
 * notifies nobody is the control that actually gets used, and it is the one
 * that ships today — Block is a backend route that still 404s in some
 * environments, and Report is a queue somebody has to read.
 *
 * Muting is CLIENT-LOCAL and belongs to whichever surface owns the audio, so
 * it is passed in rather than implemented here. Everything else is the
 * existing `useProfileSafety` hook, which already knows to go quiet when the
 * block endpoint is not deployed — there is no second block path.
 *
 * The profile is fetched from the HANDLE rather than passed in: the caller is
 * a room that learned a username from a media-plane token and has no Profile
 * object at all.
 */
function Row({
  icon,
  label,
  hint,
  tone = "default",
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="ws-row flex w-full items-center gap-3 px-1 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <span className={tone === "danger" ? "text-down" : "text-meta"}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[13px] font-semibold ${tone === "danger" ? "text-down" : "text-body"}`}
        >
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-[11px] leading-4 text-meta">{hint}</span>}
      </span>
    </button>
  );
}

export function PersonSafetyRows({
  username,
  /**
   * Client-local silence, owned by the surface that owns the audio.
   *
   * Omitted where there is nothing to mute (a profile with no live audio), in
   * which case the row is simply absent rather than disabled — an action that
   * could never apply is not a disabled action.
   */
  mute,
}: {
  username: string;
  mute?: { muted: boolean; onToggle: () => void };
}) {
  const gate = useGate();
  const profile = useProfile(username);
  return (
    <div>
      {mute && (
        <Row
          icon={<IconVolume className="h-4 w-4" muted={!mute.muted} />}
          label={mute.muted ? "Unmute for me" : "Mute for me only"}
          hint="Only you stop hearing them. Nobody is told."
          onClick={mute.onToggle}
        />
      )}
      {profile.data ? (
        <SafetyActions profile={profile.data} gate={gate} />
      ) : (
        // No profile means no id, and every action below is keyed on the id.
        // Rendering them disabled would offer controls that cannot resolve.
        <p className="px-1 py-3 text-[11px] leading-4 text-meta">
          {profile.isPending ? "Loading their profile…" : "We couldn't load their profile."}
        </p>
      )}
    </div>
  );
}

function SafetyActions({ profile, gate }: { profile: Profile; gate: (fn: () => void) => void }) {
  const safety = useProfileSafety(profile);
  return (
    <>
      {/* Hidden, not disabled, once the service has answered "no such route":
          an action that cannot be performed is not an action. */}
      {!safety.blockUnavailable && (
        <Row
          icon={<IconShield className="h-4 w-4" />}
          tone="danger"
          label={profile.isBlocked ? "Unblock" : "Block"}
          disabled={safety.block.isPending}
          onClick={() => gate(() => safety.block.mutate(!profile.isBlocked))}
        />
      )}
      <Row
        icon={<IconFlag className="h-4 w-4" />}
        label="Report"
        disabled={safety.report.isPending}
        // "other", explicitly. This row is the escape hatch inside a live
        // room, where the reader wants out of a conversation rather than a
        // taxonomy — the reason picker lives on the person card and the
        // profile, where there is room for one and time to read it.
        onClick={() => gate(() => safety.report.mutate("other"))}
      />
    </>
  );
}

/**
 * The follow control, from a handle.
 *
 * Same reason as above: a house knows a username off the media plane, and
 * `FollowPill` needs the whole Profile. Renders nothing until the profile
 * arrives, rather than a placeholder pill that would flip state under the
 * thumb the moment it did.
 */
export function PersonFollow({ username }: { username: string }) {
  const profile = useProfile(username);
  if (!profile.data) return null;
  return <FollowPill profile={profile.data} />;
}

/**
 * Draws its children unless the viewer has blocked this person, looked up by
 * username or, when a room token carried none, by account id.
 *
 * The host's Invite to speak row goes through this in a house: a person the
 * host blocked is simply not offered, rather than offered and then refused.
 * NOT shown until the profile has loaded: while it loads, or when it fails,
 * the block is unknown, and a row drawn then offered a blocked person the
 * invitation. A block BY the target is not on this edge and stays the
 * service's to refuse quietly.
 */
export function HideIfBlocked({ handle, children }: { handle: string; children: React.ReactNode }) {
  // A username or an account id: `GET /profiles/:handle` resolves either.
  const profile = useProfile(handle);
  if (!profile.data || profile.data.isBlocked) return null;
  return <>{children}</>;
}
