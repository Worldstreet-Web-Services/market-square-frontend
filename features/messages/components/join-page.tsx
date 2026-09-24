"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { errorCode } from "@/lib/api/envelope";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAcceptInvite, useInvitePreview } from "@/features/messages/hooks/use-messages";
import { inviteState } from "@/features/messages/lib/invites";
import { sq } from "@/lib/square-path";

const BUTTON =
  "ws-press inline-flex h-10 items-center justify-center rounded-full bg-accent px-6 text-[15px] font-bold text-ink transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";

/**
 * `/join/<token>` — where a shared house invite lands.
 *
 * Answers for anyone holding the link, signed in or not: the house's picture,
 * name, description and size, then the ONE thing this reader can do with it.
 * Join, sign in to join, open a house they are already in, or be told plainly
 * that the link has expired, been used up, or cannot let them in. Joining goes
 * straight into the house's chat.
 */
export function JoinPage({ token }: { token: string }) {
  const { authenticated, login } = useAuth();
  const router = useRouter();
  const preview = useInvitePreview(token);
  const accept = useAcceptInvite();

  if (preview.isPending) {
    return (
      <div className="px-4 py-10 md:px-8">
        <div className="ws-card mx-auto h-[280px] max-w-[420px] animate-pulse" />
      </div>
    );
  }

  if (preview.isError) {
    return (
      <div className="px-4 py-10 md:px-8">
        {errorCode(preview.error) === "NOT_FOUND" ? (
          <EmptyState
            className="mx-auto max-w-[420px]"
            title="This invite link doesn't work"
            body="It may have been turned off, or the house has changed. Ask for a new link."
          />
        ) : (
          <ErrorState
            className="mx-auto max-w-[420px]"
            error={preview.error}
            fallback="Couldn't open this invite."
            onRetry={() => void preview.refetch()}
          />
        )}
      </div>
    );
  }

  const house = preview.data;
  const state = inviteState(house, authenticated);
  const name = house.title ?? "A house on Square";

  return (
    <div className="px-4 py-10 md:px-8">
      <section className="ws-card mx-auto max-w-[420px] overflow-hidden text-center">
        {/*
          THE HOUSE'S PICTURE IS A BANNER, NOT AN AVATAR.

          It was a 72px disc, which is the shape of a person. A house's
          `imageUrl` is a COVER — wide, composed, with its name often set into
          the artwork — and cropping it to a circle threw away most of it and
          made the one thing the reader is being invited into the smallest
          element on the card (ogazboiz, 2026-09-24: "normally houses are just
          the background picture, so for this invite we are going to make it a
          banner so it will fill the top").

          The same call `house-profile-screen` already made and argued: a house
          has exactly ONE image, so drawing it twice — a banner behind and a
          disc in front — prints the same picture a few pixels apart. The
          banner IS the picture; the name sits under it.

          Full bleed, so the card is `overflow-hidden` with its padding moved
          onto the content below rather than sitting on the section.
        */}
        <div className="relative aspect-[420/160] w-full bg-[#101012]">
          {house.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- media hosts are unknown at build time */
            <img src={house.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            /* The same coverless treatment the house page draws, rather than a
               second invention: a house with no picture still has a top. */
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(160deg,#241640_0%,#101012_70%)]"
            />
          )}
          {/* NO FADE INTO THE CARD, deliberately. A gradient down to the
              card's colour is the obvious polish and it cannot be done
              honestly here: `ws-card` is `rgba(255,255,255,0.05)`, a
              TRANSLUCENT white over whatever is behind it, so there is no
              fixed colour to fade to. Picking `--color-raised` would blend
              into a surface the card is not, and the seam would show as a
              band rather than hide. A clean edge is correct. */}
        </div>

      <div className="flex flex-col items-center gap-3 px-6 pb-8 pt-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-meta">
          You&apos;re invited to join
        </p>
        <h1 className="text-[20px] font-bold leading-7 text-white">{name}</h1>
        {house.description && (
          <p className="text-[14px] leading-5 text-grey-300">{house.description}</p>
        )}
        <p className="text-[12px] leading-4 text-meta">
          {house.memberCount !== null &&
            `${house.memberCount} ${house.memberCount === 1 ? "member" : "members"} · `}
          {house.visibility === "private" ? "Private house" : "Public house"}
        </p>

        <div className="mt-3">
          {state === "member" && (
            <Link href={sq(`/messages?c=${house.id}`)} className={BUTTON}>
              Open chat
            </Link>
          )}
          {state === "join" && (
            <button
              type="button"
              disabled={accept.isPending}
              onClick={() =>
                accept.mutate(token, { onSuccess: (joined) => router.push(sq(`/messages?c=${joined.id}`)) })
              }
              className={BUTTON}
            >
              {accept.isPending ? "Joining…" : "Join house"}
            </button>
          )}
          {state === "sign-in" && (
            <button type="button" onClick={login} className={BUTTON}>
              Sign in to join
            </button>
          )}
          {state === "expired" && (
            <p className="text-[14px] leading-5 text-grey-300">This link has expired. Ask for a new one.</p>
          )}
          {state === "used_up" && (
            <p className="text-[14px] leading-5 text-grey-300">This link has been used up. Ask for a new one.</p>
          )}
          {state === "refused" && (
            <p className="text-[14px] leading-5 text-grey-300">You can&apos;t join this house with this link.</p>
          )}
        </div>
      </div>
      </section>
    </div>
  );
}
