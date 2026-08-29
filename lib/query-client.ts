import { QueryClient } from "@tanstack/react-query";
import { errorCode } from "@/lib/api/envelope";
import { retryDelay } from "@/lib/retry-delay";

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
        retry: (failureCount, error) => {
          const code = errorCode(error);
          // Never retry a rate-limited or forbidden request.
          if (code === "RATE_LIMITED" || code === "FORBIDDEN" || code === "NOT_FOUND") return false;
          // The breaker already said the backend is down. Retrying is asking
          // the same question two more times and paying for both — the
          // cooldown is what decides when to ask again.
          if (code === "SERVICE_DOWN") return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => retryDelay(attempt),
      },
    },
  });
}
