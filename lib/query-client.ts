import { QueryClient } from "@tanstack/react-query";
import { errorCode } from "@/lib/api/envelope";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
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
