"use client";

import { sq } from "@/lib/square-path";
import { useEffect } from "react";
import Link from "next/link";
import { reportClientError } from "@/lib/report-error";

/**
 * THE ROUTE ERROR BOUNDARY — the app had none.
 *
 * Without this, a component that throws anywhere under `app/` takes the whole
 * page to Next's default error screen: no branding, no way back, and no report.
 * Every one of this week's render bugs would have looked like that to a user.
 *
 * It does two jobs and they are separate: TELL SOMEBODY (the report, fired once
 * per error via the effect) and GIVE THE READER A WAY OUT (`reset`, which
 * re-renders the segment without a full reload, plus a link home for when the
 * segment is what is broken).
 *
 * The copy says what is true — something on this page failed — and does not
 * guess at a cause or promise it is temporary. `digest` is shown because it is
 * the string that correlates to the server-side log line; it is the one thing
 * that turns "it broke" into a searchable incident.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="text-[20px] font-bold leading-7 text-white">Something broke on this page</h1>
      <p className="max-w-[420px] text-[15px] leading-6 text-white/50">
        It has been reported. You can try again — if it keeps happening, the rest of the square is
        still working.
      </p>
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={reset}
          className="ws-btn-silver ws-press rounded-full px-5 py-2 text-[13px] font-bold"
        >
          Try again
        </button>
        {/* `Link`, not an `<a>`: only this SEGMENT failed, so the router is
            still alive and a soft navigation keeps the shell mounted. The
            root-layout case is `global-error.tsx`, which cannot rely on that
            and does not. */}
        <Link
          href={sq("/")}
          className="ws-press rounded-full border border-white/20 px-5 py-2 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
        >
          Go home
        </Link>
      </div>
      {error.digest && (
        <p className="pt-2 text-[12px] leading-4 text-white/30">Reference: {error.digest}</p>
      )}
    </div>
  );
}
