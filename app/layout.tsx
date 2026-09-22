import type { Metadata, Viewport } from "next";
import { Geist, Inter, Manrope, Roboto } from "next/font/google";
import Providers from "./providers";
import { AppShell } from "@/components/layout/app-shell";
import { FALLBACK_OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, siteOrigin } from "@/lib/og-metadata";
import { SplashScreen } from "@/components/layout/splash-screen";
import { SignInOverlay } from "@/components/layout/sign-in-overlay";
import { asset } from "@/lib/square-path";
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

/**
 * Manrope, for Home's section headings.
 *
 * The 2026-09-12 Home design sets every section heading in it — "Top
 * GistRooms", "Make some friends", "Coming Soon", "Popular Houses" — all at
 * Bold 24/28.61. It is a display face used consistently rather than a
 * one-string stand-in, and ogazboiz's instruction was to follow the file, so it
 * is loaded rather than substituted with Geist.
 *
 * Two weights, latin only, and it belongs to those headings alone: body copy is
 * still Geist.
 */
/**
 * Inter, bold and extra-bold ITALIC only: the emphasised words on Home's first
 * banner slide (1676:17258, `styleOverrideTable` 1487 / 1488). Geist has no
 * italic, and a browser-slanted Geist is not the file's letterform.
 */
const inter = Inter({
  variable: "--font-inter",
  weight: ["700", "800"],
  style: ["italic"],
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-heading",
  weight: ["600", "700"],
  subsets: ["latin"],
});

/*
  THE CARD EVERY ROUTE UNFURLS INTO UNLESS IT SAYS OTHERWISE.

  Only `/p/[id]` and `/u/[username]` publish data-driven previews. Rooms,
  houses, invites and room codes inherit this generic branded card on purpose:
  a private group's title or picture, copied into a chat app's preview cache,
  would outlive a renamed group and a revoked invite. A child segment that sets
  `openGraph` REPLACES this object rather than merging into it (metadata merges
  shallowly), so a post never inherits this image by accident.
*/
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin(process.env)),
  /*
    DECLARED WITH THE PREFIX, for the same reason the icons above are. Next's
    `app/manifest.ts` convention emits `href="/manifest.webmanifest"`, which
    inside Ark (www.tsionark.com/square) points at WSWS's origin root and would
    hand Safari somebody else's manifest — or none.
  */
  manifest: asset("/manifest.webmanifest"),
  /*
    iOS READS THIS, NOT ONLY THE MANIFEST. Safari has honoured
    `apple-mobile-web-app-capable` far longer than it has honoured the
    manifest's `display`, and web push on an iPhone is only delivered to a Home
    Screen app — so both say "standalone" and neither is load-bearing alone.
    `statusBarStyle` keeps the status bar legible on the app's black wash.
  */
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  /*
    AND THE LEGACY SPELLING, BY HAND. `appleWebApp.capable` now emits the
    unprefixed `mobile-web-app-capable` and nothing else — verified in the
    built HTML, not assumed. iOS 16.4 is the first version with web push and
    the first that reads `display` out of the manifest, so the manifest alone
    is enough on paper; through 17.3 the prefixed meta is the one Safari has
    always honoured, and it costs a line.
  */
  other: { "apple-mobile-web-app-capable": "yes" },
  /*
    Declared, not the `app/icon.svg` file convention: that convention writes a
    root `/icon.svg` link, which inside Ark (www.tsionark.com/square) would load
    WSWS's icon. Same two files, same sizes and types, through `asset()`.
  */
  icons: {
    icon: [{ url: asset("/icon.svg"), sizes: "any", type: "image/svg+xml" }],
    apple: [{ url: asset("/apple-icon.png"), sizes: "180x180", type: "image/png" }],
  },
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [FALLBACK_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [FALLBACK_OG_IMAGE],
  },
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
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${roboto.variable} ${inter.variable} ${manrope.variable}`}>
      <body className="ws-wash min-h-dvh">
        <Providers>
          {/* Above everything, including the bare routes the shell steps out of
              — a splash that the live room could render over would be a splash
              that only covers some of the boot. */}
          <SplashScreen />
          {/* Under the splash, over the app: what a first-time, signed-out
              visitor to the front door sees once the boot sequence ends. */}
          <WelcomeGate />
          {/* The app's one sign-in surface, opened from anywhere by
              `useAuth().login`. Under the welcome, over everything else. */}
          <SignInOverlay />
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
