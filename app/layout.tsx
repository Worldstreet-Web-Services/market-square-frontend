import type { Metadata } from "next";
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
