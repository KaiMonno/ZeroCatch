import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
  themeColor: "#0b0d10",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-5">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-fg">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-lg bg-emerald-400 text-sm font-black text-emerald-950"
            >
              0
            </span>
            ZeroCatch
          </Link>
          <span className="text-xs text-muted">No traps. No affiliate junk.</span>
        </header>
        {children}
        <footer className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-3 gap-y-1 px-4 pb-8 text-xs text-muted">
          <Link href="/what-qualifies" className="underline-offset-4 hover:text-fg hover:underline">
            What qualifies
          </Link>
          <span aria-hidden>·</span>
          <span>Open source</span>
          <span aria-hidden>·</span>
          <span>Deals are checked, but always confirm terms before signing up.</span>
        </footer>
      </body>
    </html>
  );
}
