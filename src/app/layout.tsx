import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { OfflineBanner } from "@/components/offline-banner";
import { ServiceWorker } from "@/components/service-worker";
import { UserMenu } from "@/components/user-menu";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: `${SITE_NAME}: ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  openGraph: { type: "website", siteName: SITE_NAME, url: "/" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0a0c0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <OfflineBanner />
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-5">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-fg">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-lg bg-emerald-400 text-sm font-black text-emerald-950"
            >
              0
            </span>
            ZeroCatch
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] uppercase tracking-widest text-muted sm:inline">No traps · No affiliate junk</span>
            {/* Reads the session cookie, so it streams in after the static header. */}
            <Suspense fallback={<span className="h-8 w-16" aria-hidden />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        {children}
        <footer className="mx-auto mt-8 w-full max-w-5xl px-4 pb-10">
          <div className="flex flex-col gap-4 border-t border-dashed border-line-strong pt-6 text-xs text-muted sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-display text-base font-bold text-fg">ZeroCatch</p>
              <p className="mt-1 max-w-xs">Deals are checked, but always confirm terms before signing up.</p>
            </div>
            <nav aria-label="Footer" className="flex gap-5">
              <Link href="/what-qualifies" className="underline-offset-4 hover:text-fg hover:underline">
                What qualifies
              </Link>
              <a
                href="https://github.com/KaiMonno/ZeroCatch"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:text-fg hover:underline"
              >
                Open source
              </a>
            </nav>
          </div>
        </footer>
        <ServiceWorker />
      </body>
    </html>
  );
}
