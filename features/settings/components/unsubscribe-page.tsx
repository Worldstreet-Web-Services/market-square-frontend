"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useQueryParam } from "@/hooks/use-query-param";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import { ColumnHeader } from "@/components/layout/column-header";
import { unsubscribeEmailDigest } from "@/features/settings/lib/api";
import { sq } from "@/lib/square-path";

const BUTTON =
  "ws-press inline-flex h-10 items-center justify-center rounded-full bg-accent px-6 text-[15px] font-bold text-ink transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";

/**
 * `/unsubscribe?token=…` — where the link in a daily email summary lands.
 *
 * It asks before it acts: a BUTTON turns the summaries off, never the page
 * load, because mail providers' link scanners open every link in an email and
 * would otherwise switch people's summaries off for them. Works signed out —
 * the token is signed for the one person it belongs to. (A mail client's own
 * one-click unsubscribe goes straight to the service and never needs this.)
 */
export function UnsubscribePage() {
  const token = useQueryParam("token");
  const unsubscribe = useMutation({ mutationFn: (value: string) => unsubscribeEmailDigest(value) });
  const code = unsubscribe.isError ? errorCode(unsubscribe.error) : null;

  let title: string;
  let body: string;
  let action: React.ReactNode = null;

  if (unsubscribe.isSuccess) {
    title = "Email summaries are off";
    body =
      "You won't get Square's daily email summary any more. You can turn it back on in Settings → Notifications.";
    action = (
      <Link href={sq("/")} className={BUTTON}>
        Back to Square
      </Link>
    );
  } else if (!token || code === "VALIDATION_ERROR" || code === "VALIDATION") {
    title = "This link isn't valid";
    body = "Open Square and go to Settings → Notifications to turn email summaries off.";
    action = (
      <Link href={sq("/")} className={BUTTON}>
        Open Square
      </Link>
    );
  } else if (code === "NOT_CONFIGURED") {
    title = "Email summaries aren't set up here";
    body = "There is nothing to turn off.";
    action = (
      <Link href={sq("/")} className={BUTTON}>
        Back to Square
      </Link>
    );
  } else {
    title = "Turn off email summaries?";
    body =
      "You'll stop getting Square's daily email about new notifications. Push and in-app notifications don't change.";
    action = (
      <div className="flex flex-col items-center gap-3">
        {unsubscribe.isError && (
          <p className="text-[13px] leading-5 text-down">
            {errorMessage(unsubscribe.error, "Couldn't turn off email summaries.")}
          </p>
        )}
        <button
          type="button"
          disabled={unsubscribe.isPending}
          onClick={() => unsubscribe.mutate(token)}
          className={BUTTON}
        >
          {unsubscribe.isPending ? "Turning off…" : unsubscribe.isError ? "Try again" : "Turn off email summaries"}
        </button>
      </div>
    );
  }

  return (
    <>
      <ColumnHeader title="Email summaries" />
      <div className="px-4 py-6">
        <section className="flex flex-col items-center gap-3 rounded-[16.5px] border border-white/10 bg-transparent px-6 py-10 text-center">
          <h2 className="ws-display text-[18px] text-white">{title}</h2>
          <p className="max-w-sm text-[14px] leading-5 text-grey-400">{body}</p>
          <div className="mt-3">{action}</div>
        </section>
      </div>
    </>
  );
}
