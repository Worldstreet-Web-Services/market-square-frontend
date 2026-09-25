import type { Metadata } from "next";
import { AuthCallbackPage } from "@/features/profile";

export const metadata: Metadata = { title: "Signing you in" };

/*
  NEVER PRERENDERED, AND NOT AS A BUILD WORKAROUND.

  This page exists to catch an OAuth redirect: everything it does is read what
  the provider put in the URL and finish a session. There is no state of it
  worth computing at build time, so a prerender produces a shell nobody sees
  and one more way for the build to fail.

  And it DID fail. `AuthCallbackPage` calls `useSocialAuth()`, which throws
  unless it is inside `<DecaneKit>` — and the kit only mounts once
  `useDecaneCredentials()` resolves, which is a browser fetch. Whether a
  prerender got far enough to call the hook depended on whether
  NEXT_PUBLIC_DECANE_APP_ID was set at build time, so:

      market-square-frontend   env set     -> built
      market-square-ark        env missing -> "Decane hooks must be called
                                              inside <DecaneKit>"

  ONE COMMIT, TWO VERCEL PROJECTS, ONE GREEN AND ONE RED. Reproduced locally by
  removing the two Decane variables and rebuilding.

  Adding the variables to the second project would also have made it build, and
  would have left a page whose BUILD depends on a runtime credential being
  present — a trap for the next deployment that is configured slightly
  differently. A page that cannot be usefully prerendered should say so.
*/
export const dynamic = "force-dynamic";

export default function Page() {
  return <AuthCallbackPage />;
}
