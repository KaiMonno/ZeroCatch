import { ExternalLink, Sparkles } from "lucide-react";
import type { Deal } from "@/lib/types";
import { CardActions } from "./card-actions";
import { DealBadges } from "./deal-badges";
import { ExpiryLabel } from "./expiry-label";
import { Perforation } from "./perforation";

/** The featured deal (Epic's weekly free games): a bigger ticket with a $0 stamp. */
export function HeroCard({ deal, claimed = false }: { deal: Deal; claimed?: boolean }) {
  return (
    <section
      aria-labelledby={`hero-${deal.id}`}
      className="relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-emerald-400/20 bg-linear-to-br from-emerald-500/[0.14] via-surface to-surface p-5 sm:p-7"
    >
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-emerald-400/10 blur-3xl" />
      <span
        aria-hidden
        className="absolute right-5 top-5 rotate-[7deg] rounded-md border-2 border-emerald-300/35 px-2 py-0.5 font-mono text-xs font-bold tracking-[0.2em] text-emerald-300/70 sm:right-7 sm:top-7"
      >
        $0.00
      </span>

      <div className="flex flex-col gap-2 pr-20">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
          <Sparkles aria-hidden className="size-3.5" />
          Featured · {deal.merchant}
        </p>
        <h2 id={`hero-${deal.id}`} className="text-[28px] font-bold leading-[1.1] text-fg sm:text-4xl">
          {deal.title}
        </h2>
      </div>
      {deal.description && (
        <p className="-mt-2 line-clamp-2 max-w-prose sm:line-clamp-3 text-sm leading-relaxed text-muted sm:text-base">{deal.description}</p>
      )}

      <div className="mt-auto flex flex-col gap-5">
        <DealBadges deal={deal} />
        <Perforation inset="-mx-5 sm:-mx-7" />
        <CardActions
          dealId={deal.id}
          dealTitle={deal.title}
          merchant={deal.merchant}
          claimed={claimed}
          lead={
            <>
              <a
                href={deal.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-[0_8px_24px_-8px_rgb(52_211_153/0.6)] transition-colors hover:bg-emerald-300"
              >
                Claim it free
                <ExternalLink aria-hidden className="size-4" />
              </a>
              <ExpiryLabel expiresAt={deal.expires_at} />
            </>
          }
        />
      </div>
    </section>
  );
}
