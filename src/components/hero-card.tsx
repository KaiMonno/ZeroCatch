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
      className="group/hero relative flex w-full flex-col gap-5 overflow-hidden rounded-3xl border border-emerald-400/20 bg-linear-to-br from-emerald-500/[0.14] via-surface to-surface p-5 sm:p-7"
    >
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-emerald-400/10 blur-3xl" />
      <span
        aria-hidden
        className="absolute right-5 top-5 rotate-[7deg] animate-stamp rounded-md border-2 border-emerald-300/35 px-2 py-0.5 font-mono text-xs font-bold tracking-[0.2em] text-emerald-300/70 transition-[rotate,scale] duration-300 group-hover/hero:rotate-[-4deg] group-hover/hero:scale-110 sm:right-7 sm:top-7"
      >
        $0.00
      </span>

      <div className="flex flex-col gap-2 pr-20">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
          <Sparkles aria-hidden className="size-3.5 transition-transform duration-500 group-hover/hero:rotate-180" />
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
                className="group/claim relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-[0_8px_24px_-8px_rgb(52_211_153/0.6)] transition hover:-translate-y-px hover:bg-emerald-300 hover:shadow-[0_12px_28px_-8px_rgb(52_211_153/0.7)] active:translate-y-0 active:scale-[0.97] after:pointer-events-none after:absolute after:inset-y-0 after:-left-2/5 after:w-1/4 after:-skew-x-12 after:bg-white/45 after:opacity-0 hover:after:animate-shine"
              >
                Claim it free
                <ExternalLink aria-hidden className="size-4 transition-transform group-hover/claim:-translate-y-0.5 group-hover/claim:translate-x-0.5" />
              </a>
              <ExpiryLabel expiresAt={deal.expires_at} />
            </>
          }
        />
      </div>
    </section>
  );
}
