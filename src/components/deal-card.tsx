import { ArrowUpRight } from "lucide-react";
import { formatDuration } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { CardActions } from "./card-actions";
import { DealBadges } from "./deal-badges";
import { ExpiryLabel } from "./expiry-label";
import { MerchantMark } from "./merchant-mark";
import { Perforation } from "./perforation";

/**
 * A deal as a ticket: who and what above the tear line, time left and
 * actions below it. The whole card links to the deal (title link overlay).
 */
export function DealCard({ deal, claimed = false }: { deal: Deal; claimed?: boolean }) {
  return (
    <article className="group relative flex w-full flex-col gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-2 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-emerald-400">
      <div className="flex items-center gap-2.5">
        <MerchantMark merchant={deal.merchant} />
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{deal.merchant}</p>
        {deal.trial_duration_days ? (
          <span className="shrink-0 rounded-md bg-sky-400/10 px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-sky-200">
            {formatDuration(deal.trial_duration_days)}
          </span>
        ) : (
          <ArrowUpRight
            aria-hidden
            className="size-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg"
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-[17px] font-semibold leading-snug text-fg">
          <a
            href={deal.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
          >
            {deal.title}
          </a>
        </h3>
        {deal.description && <p className="line-clamp-3 text-sm leading-relaxed text-muted">{deal.description}</p>}
      </div>

      <div className="mt-auto flex flex-col gap-4">
        <DealBadges deal={deal} />
        <Perforation />
        <CardActions
          dealId={deal.id}
          dealTitle={deal.title}
          merchant={deal.merchant}
          claimed={claimed}
          lead={<ExpiryLabel expiresAt={deal.expires_at} />}
        />
      </div>
    </article>
  );
}
