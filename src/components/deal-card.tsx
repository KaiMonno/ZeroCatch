import { ArrowUpRight } from "lucide-react";
import { formatDuration } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { DealBadges } from "./deal-badges";
import { ExpiryLabel } from "./expiry-label";

export function DealCard({ deal }: { deal: Deal }) {
  return (
    <article className="group relative flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-emerald-400">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{deal.merchant}</p>
          <h3 className="mt-0.5 text-base font-semibold leading-snug text-fg">
            <a
              href={deal.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
            >
              {deal.title}
            </a>
          </h3>
        </div>
        {deal.trial_duration_days ? (
          <span className="shrink-0 rounded-lg bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-200">
            {formatDuration(deal.trial_duration_days)}
          </span>
        ) : (
          <ArrowUpRight
            aria-hidden
            className="size-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        )}
      </div>

      {deal.description && <p className="text-sm leading-relaxed text-muted">{deal.description}</p>}

      <div className="mt-auto flex flex-col gap-2.5">
        <DealBadges deal={deal} />
        <ExpiryLabel expiresAt={deal.expires_at} />
      </div>
    </article>
  );
}
