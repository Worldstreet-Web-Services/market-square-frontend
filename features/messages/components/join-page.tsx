"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { errorCode } from "@/lib/api/envelope";
import { Avatar } from "@/components/ui/avatar";
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
      <section className="ws-card mx-auto flex max-w-[420px] flex-col items-center gap-3 px-6 py-8 text-center">
        <Avatar name={name} seed={house.id} src={house.imageUrl} size={72} />
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
      </section>
    </div>
  );
}
