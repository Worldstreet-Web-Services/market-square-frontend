"use client";

import { cn } from "@/lib/cn";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { IconWink } from "@/components/ui/icons";
import { IconMsWinkFace } from "@/components/ui/design-icons";
import { IconProfileWink } from "@/components/ui/profile-icons";
import type { Profile } from "@/lib/api/schemas";
import { useWink } from "@/features/profile/hooks/use-profile";

/**
 * The wink control, wherever a person appears.
 *
 * ONE component for the person card and the profile, for the same reason
 * `PersonRow` is one component: a second variant is how two interest signals
 * with two different rate limits end up shipping, and the one that matters
 * here is the limit.
 *
 * COLOUR. Silver at rest, like every other neutral control on the square. Sent
 * turns it `--color-create` — the light stop of the one purple ramp, 5.77:1 on
 * black, which is the stop for ink and small glyphs — with the ramp's own tint
 * and hairline behind it (12% fill, 40% border), the treatment the sidebar's
 * active nav item already uses. It is emphatically NOT `--color-like`: that
 * token means the liked heart and only the liked heart, and a wink is a
 * different act addressed to a different object. Semantic tokens own one
 * meaning each.
 *
 * ABSENT, not disabled, in the two cases where the action could never apply:
 * your own row, and a service that has answered "no such route". A disabled
 * control invites the reader to work out what would enable it; there is no
 * answer to either.
 *
 * REFUSED, and disabled, when the rules say not now — already winked, budget
 * spent, blocked. The reason is the button's accessible name as well as its
 * tooltip, so it is not sighted-only, and it is specific: "you already winked
 * them" rather than "unavailable".
 */
export function WinkButton({
  profile,
  size = "sm",
}: {
  profile: Profile;
  /**
   * `sm` sits in a 24px list row; `md` sits beside Follow on a profile.
   *
   * `post` is node 496:13393 — the post header's, and the only FILLED one:
   * a 33.26 disc carrying the purple ramp (--color-create into
   * --color-spotlight, which is exactly what the file's two stops measure) with
   * the design's own white line-art face on it at 22.15. It is filled because
   * on a post header it stands beside a filled tip button and an outlined
   * Follow, and it is the invitation of the three.
   *
   * 33.26 AND NOT 40.73. The node is ROTATED 15°, and a rotated node's
   * bounding box is not its size — 33.26 × (cos15 + sin15) = 40.73 is the box
   * the tilt needs, not the disc. Built at the box it was half a control
   * larger than the 34-tall tip button beside it, which the design draws the
   * same height. Its face is rotated a further -17.77° inside it, so the face
   * sits 2.77° off upright; on a 22px smiley that is invisible and is not
   * drawn. The 15° IS carried, in the gradient: local top-to-bottom turned by
   * the rotation is 195deg on the page.
   */
  /**
   * `cover` is node 545:47604 — the stranger's profile cover. A 91x38 pill on
   * the 90deg `#9F65FD -> #5B05E6` ramp (`ws-btn-welcome`, the same two stops
   * every 90deg purple pill in the app uses) behind a transparent top layer,
   * 8.08 of padding, the file's own 16px wink face 10.1 from the label, "Wink"
   * at 14.94/25.61. Its stroke is white at weight ZERO, which renders nothing:
   * no border. Sent dims it, as the post's filled disc does.
   */
  size?: "sm" | "md" | "post" | "cover";
}) {
  const gate = useGate();
  const me = useMe();
  const wink = useWink(profile);

  // You are not somebody you can be interested in, and a self-wink would
  // notify nobody. Checked against the real viewer rather than assumed
  // impossible — you can land on your own profile.
  if (me.data?.id === profile.id) return null;
  // The service has said the route does not exist. An action that cannot be
  // performed is not an action.
  if (wink.unavailable) return null;

  const refused = wink.refusal !== null;
  const label = refused
    ? wink.refusal!
    : `Wink at ${profile.displayName} — let them know you're interested`;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={wink.winked}
      disabled={refused || wink.isPending}
      onClick={() => gate(() => wink.send())}
      className={cn(
        "ws-press flex shrink-0 items-center justify-center rounded-full transition-colors",
        size === "cover" &&
          cn(
            "ws-btn-welcome h-[38px] w-[91px] gap-[10.1px] p-[8.08px] text-[14.94px] leading-[25.61px] text-white",
            wink.winked && "opacity-60"
          ),
        size === "post" &&
          cn(
            "h-[33.26px] w-[33.26px] text-white",
            "bg-[linear-gradient(195deg,var(--color-create)_0%,var(--color-spotlight)_100%)]",
            // Sent: the same disc, dimmed, rather than a different colour.
            // The ramp IS the control here, so recolouring it would read as
            // a second kind of button rather than the same one already used.
            wink.winked && "opacity-60"
          ),
        (size === "sm" || size === "md") &&
          cn(
            "border",
            size === "sm" ? "h-6 w-6" : "h-8 w-8",
            wink.winked
              ? "border-create/40 bg-create/12 text-create"
              : "border-white/20 text-body hover:bg-white/10 hover:text-heading"
          ),
        // A refusal that is not "already winked" stays neutral and dimmed —
        // colouring it would read as a state the reader had reached rather
        // than a door that is shut.
        refused && !wink.winked && "cursor-not-allowed opacity-40"
      )}
    >
      {size === "cover" ? (
        <>
          <IconProfileWink className="h-4 w-4 shrink-0" />
          Wink
        </>
      ) : size === "post" ? (
        <IconMsWinkFace className="h-[22.15px] w-[22.15px] shrink-0" />
      ) : (
        <IconWink className={size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"} />
      )}
    </button>
  );
}
