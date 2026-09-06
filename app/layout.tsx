import type { Metadata, Viewport } from "next";
import { Geist, Roboto } from "next/font/google";
import Providers from "./providers";
import { AppShell } from "@/components/layout/app-shell";
import { SplashScreen } from "@/components/layout/splash-screen";
import { WelcomeGate } from "@/components/layout/welcome/welcome-gate";
import "./globals.css";

const geist = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

/**
 * Roboto, for the handful of surfaces the design actually sets in it.
 *
 * Geist is the product's typeface and nearly every string in the design is set
 * in it. Two things are not, and in both cases it is measurable rather than a
 * matter of taste:
 *
 *   · the welcome screens' sub-copy. In Geist, screen 1's two lines run 389px
 *     against the file's 372 — 4.5% wide, enough to move where the copy wraps.
 *   · the people-deck cards on Home (node 225:3374), whose name is Roboto 600
 *     and handle Roboto 400. Those cards are the same purple-gradient object
 *     the welcome screens use, and the design sets their type the same way.
 *
 * Two weights, latin only. Nothing else in the app may reach for this.
 */
const roboto = Roboto({
  variable: "--font-roboto",
  weight: ["400", "600"],
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
    <html lang="en" className={`${geist.variable} ${roboto.variable}`}>
      <body className="ws-wash min-h-dvh">
        <Providers>
          {/* Above everything, including the bare routes the shell steps out of
              — a splash that the live room could render over would be a splash
              that only covers some of the boot. */}
          <SplashScreen />
          {/* Under the splash, over the app: what a first-time, signed-out
              visitor to the front door sees once the boot sequence ends. */}
          <WelcomeGate />
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
