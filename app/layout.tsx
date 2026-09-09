import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Providers from "./providers";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const geist = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Market Square", template: "%s · Market Square" },
  description:
    "The social square of the Ark platform: live streams, the ARK Store, creators and community.",
};

/**
 * `interactive-widget: resizes-content` makes the on-screen keyboard SHRINK the
 * layout viewport instead of sliding it up. Without it a bottom sheet stays the
 * full height of the screen while the keyboard covers its lower half, so the
 * field being typed into — and the button underneath — sit behind the keyboard
 * with no way to scroll to them. `viewportFit: "cover"` lets the safe-area
 * insets we pad with actually report a value.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="ws-wash min-h-dvh">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
