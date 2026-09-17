import { api } from "./square-path.ts";
/**
 * CLIENT ERROR REPORTING — the thing this app had none of.
 *
 * There was no error boundary and no monitoring of any kind, so a component
 * that threw in production showed Next's default screen and NOBODY WAS TOLD.
 * Three real bugs were found this week by a person clicking, which is the only
 * detection mechanism that existed.
 *
 * Deliberately dependency-free rather than reaching for Sentry: this needs no
 * account, no DSN, no bundle weight and no vendor decision, and it puts the
 * failure somewhere a human can read it TODAY. It is the seam a real APM slots
 * into later — one `fetch` to replace.
 *
 * IT MUST NEVER THROW. A reporter that fails inside an error handler turns one
 * broken screen into an unrecoverable one, so every path here swallows.
 * `keepalive` so a report survives the navigation that often follows a crash.
 */
export interface ClientErrorReport {
  message: string;
  stack?: string;
  /** Next's own error digest, which correlates to the server-side log line. */
  digest?: string;
  /** Where it happened — the route, not the person. */
  url?: string;
}

export function reportClientError(error: unknown, extra?: { digest?: string }): void {
  try {
    if (typeof window === "undefined") return;
    const err = error instanceof Error ? error : new Error(String(error));
    const body: ClientErrorReport = {
      message: err.message.slice(0, 500),
      // Capped: a stack is the useful part, a megabyte of it is not.
      stack: err.stack?.slice(0, 4000),
      digest: extra?.digest,
      url: window.location.pathname + window.location.search,
    };
    void fetch(api("/api/client-errors"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* reporting must never be the thing that breaks */
  }
}
