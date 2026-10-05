import type { Metadata } from "next";
import Link from "next/link";
import { Check, Flag, X } from "lucide-react";
import { BADGES, Badge, type BadgeKind } from "@/components/deal-badges";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `What qualifies · ${SITE_NAME}`,
  description: "The rules every ZeroCatch deal has to pass: no purchase, no paid membership, no hidden catch.",
  alternates: { canonical: "/what-qualifies" },
};

const LISTED = [
  {
    title: "Pure Freebies",
    body: "Something genuinely free: a game to keep, a drink, a doughnut. A free account or app is the most we'll ever ask for, and never a payment method.",
  },
  {
    title: "Instant-Cancel Trials",
    body: "Free trials you can cancel right after signing up and still keep for the full trial period. We check each service's own terms before listing it, and tell you whether a card is needed at signup.",
  },
];

// Mirrors the reason codes in scrapers/classify.py: keep the two in sync.
const NEVER_LISTED: { rule: string; detail: string }[] = [
  { rule: "Anything that needs a purchase", detail: "No BOGO, no “free with any order”, no minimum spend." },
  { rule: "Points, credit, or gift cards", detail: "Bonus points, store cash, and promo credit aren't free stuff; they're a reason to spend." },
  { rule: "Free shipping or delivery", detail: "Shipping isn't the product. A sale with free shipping is still a sale." },
  { rule: "Paid memberships", detail: "Perks that need Prime, Circle 360, Walmart+, a phone plan, or a warehouse club. Free loyalty programs are fine." },
  { rule: "Rebates and cash back", detail: "If you pay first and get money back later, it isn't free." },
  { rule: "Limited quantities", detail: "“First 50 customers” deals that most people can't actually get." },
  { rule: "In-store events", detail: "Workshops, parties, and timed events rather than something you can claim." },
  { rule: "One audience only", detail: "Offers only for teachers, students, military, and so on." },
  { rule: "Contests and sweepstakes", detail: "A chance to win isn't a freebie." },
  { rule: "Trials that end when you cancel", detail: "If cancelling early cuts off the trial (Spotify's terms, for example), it isn't instant-cancel safe." },
  { rule: "Affiliate links", detail: "Every deal links to the brand's own page. We don't earn a cut from your click." },
];

const BADGE_ORDER: BadgeKind[] = ["no-card", "account", "instant-cancel", "card-required"];

export default function WhatQualifiesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 pb-16 pt-8">
      <header>
        <p className="text-sm font-medium text-emerald-300">How {SITE_NAME} works</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-fg">What qualifies</h1>
        <p className="mt-3 max-w-prose text-muted">
          Most deal sites list everything and leave the fine print to you. We do the opposite: a deal only appears here
          if it passes every rule below. Fewer deals, zero catches.
        </p>
      </header>

      <section aria-labelledby="listed">
        <h2 id="listed" className="text-lg font-semibold text-fg">
          What we list
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {LISTED.map((item) => (
            <li key={item.title} className="rounded-2xl border border-line bg-surface p-4">
              <p className="flex items-center gap-2 font-medium text-fg">
                <Check aria-hidden className="size-4 text-emerald-300" />
                {item.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="never">
        <h2 id="never" className="text-lg font-semibold text-fg">
          What we never list
        </h2>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
          {NEVER_LISTED.map((item) => (
            <li key={item.rule} className="flex gap-3 p-4">
              <X aria-hidden className="mt-0.5 size-4 shrink-0 text-rose-300" />
              <div>
                <p className="font-medium text-fg">{item.rule}</p>
                <p className="mt-0.5 text-sm text-muted">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="badges">
        <h2 id="badges" className="text-lg font-semibold text-fg">
          Reading the badges
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {BADGE_ORDER.map((kind) => (
            <div key={kind} className="flex flex-col items-start gap-1.5 rounded-2xl border border-line bg-surface p-4">
              <dt>
                <Badge kind={kind} />
              </dt>
              <dd className="text-sm text-muted">{BADGES[kind].help}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="sources" className="flex flex-col gap-2">
        <h2 id="sources" className="text-lg font-semibold text-fg">
          Where deals come from
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Straight from the source wherever possible: store feeds like Epic Games, Steam and GOG, brands&apos; own press
          releases, and hand-checked lists of trials and yearly food freebies. Everything is re-checked every night, and
          deals disappear the moment they end.
        </p>
      </section>

      <section aria-labelledby="report" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="report" className="flex items-center gap-2 font-semibold text-fg">
          <Flag aria-hidden className="size-4" />
          Found a catch?
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Every deal has a <span className="text-fg">Report a problem</span> link. When several people report the same
          deal, it&apos;s hidden until we&apos;ve checked it.
        </p>
        <Link href="/" className="mt-3 inline-flex rounded-lg bg-fg px-3 py-1.5 text-sm font-medium text-bg hover:opacity-90">
          Browse deals
        </Link>
      </section>
    </main>
  );
}
