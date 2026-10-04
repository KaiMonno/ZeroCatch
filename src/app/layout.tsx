import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZeroCatch: Good-Faith Freebies",
  description:
    "Verified, no-strings-attached freebies, instant-cancel free trials, and honest free-with-purchase deals. No affiliate junk, no hidden card traps.",
  applicationName: "ZeroCatch",
  appleWebApp: { capable: true, title: "ZeroCatch", statusBarStyle: "black-translucent" },
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
        <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-xs text-muted">
          Open source · Deals are checked, but always confirm terms before signing up.
        </footer>
      </body>
    </html>
  );
}
