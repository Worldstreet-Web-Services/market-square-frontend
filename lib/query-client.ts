import { QueryClient } from "@tanstack/react-query";
import { errorCode } from "@/lib/api/envelope";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 30 s of freshness, then any remount or window focus refetches.
        //
        // This pairing is what stops a backgrounded tab feeling frozen:
        // `refetchOnWindowFocus` only refetches queries that are STALE, so a
        // short staleTime is what gives it teeth. Returning to the app after
        // more than half a minute away re-pulls the feed, the unread badges
        // and every other visible query, while rapid in-session navigation
        // still serves from cache instead of re-hitting the service.
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        // Coming back from a dropped connection is the same situation as
        // coming back to the tab.
        refetchOnReconnect: true,
        // Never retry a rate-limited or forbidden request; retry other
        // transient failures twice.
        retry: (failureCount, error) => {
          const code = errorCode(error);
          if (code === "RATE_LIMITED" || code === "FORBIDDEN" || code === "NOT_FOUND") return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  });
}
