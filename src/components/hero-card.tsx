import { ExternalLink, Sparkles } from "lucide-react";
import type { Deal } from "@/lib/types";
import { DealBadges } from "./deal-badges";
import { ExpiryLabel } from "./expiry-label";

export function HeroCard({ deal }: { deal: Deal }) {
  return (
    <section
      aria-labelledby={`hero-${deal.id}`}
      className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-linear-to-br from-emerald-500/15 via-surface to-surface p-5 sm:p-7"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-emerald-400/10 blur-3xl"
      />
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
        <Sparkles aria-hidden className="size-3.5" />
        Featured · {deal.merchant}
      </p>
      <h2 id={`hero-${deal.id}`} className="mt-2 text-2xl font-bold leading-tight text-fg sm:text-3xl">
        {deal.title}
      </h2>
      {deal.description && (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted sm:text-base">{deal.description}</p>
      )}
      <div className="mt-4">
        <DealBadges deal={deal} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <a
          href={deal.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-300"
        >
          Claim it free
          <ExternalLink aria-hidden className="size-4" />
        </a>
        <ExpiryLabel expiresAt={deal.expires_at} />
      </div>
    </section>
  );
}
