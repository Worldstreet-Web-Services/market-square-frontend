"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-error";

/**
 * THE LAST BOUNDARY — for a throw in the ROOT LAYOUT itself.
 *
 * `app/error.tsx` sits inside the layout, so it cannot catch the layout
 * failing. This one replaces the whole document, which is why it renders its
 * own `<html>` and `<body>` and why every style here is INLINE: at this point
 * the app's stylesheet may be exactly what did not load. A theme-aware error
 * page that depends on the theme is not an error page.
 *
 * That failure mode is not hypothetical — running `pnpm build` under a live
 * `next start` replaced the asset hashes and every stylesheet 404'd, leaving
 * raw unstyled HTML. This is what should have been shown.
 */
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 32,
          textAlign: "center",
          background: "#0f0f0f",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Square failed to load</h1>
        <p style={{ maxWidth: 420, fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.5)", margin: 0 }}>
          It has been reported. Reloading usually fixes it.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            borderRadius: 999,
            border: "none",
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            background: "#d4d4d8",
            color: "#0a0a0a",
          }}
        >
          Try again
        </button>
        {error.digest && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
            Reference: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
