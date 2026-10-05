import { EyeOff, Flag, ExternalLink, Star } from "lucide-react";
import { formatExpiry } from "@/lib/format";
import { REPORT_REASONS, type Deal } from "@/lib/types";
import { deleteDeal, dismissReports, unhideDeal, updateDeal } from "../actions";
import { DealForm } from "../deal-form";
import type { DealReport } from "./page";

const CATEGORY_LABEL = {
  pure_freebie: "Freebie",
  free_trial: "Trial",
} as const;

export function PublishedDealRow({ deal, reports }: { deal: Deal; reports: DealReport[] }) {
  const managedBy = deal.source_key?.startsWith("epic:")
    ? "the Epic scraper"
    : deal.source_key?.startsWith("trial:")
      ? "scrapers/data/trials.toml"
      : deal.source_key?.startsWith("calendar:")
        ? "scrapers/data/food_calendar.toml"
        : null;
  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-medium">{CATEGORY_LABEL[deal.category]}</span>
        <span>{deal.merchant}</span>
        <span>· {formatExpiry(deal.expires_at).label}</span>
        {deal.is_hero_featured && <Star aria-label="Featured" className="size-3.5 text-emerald-300" />}
      </div>
      <h3 className="mt-1 font-semibold text-fg">
        <a href={deal.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 hover:underline">
          {deal.title}
          <ExternalLink aria-label="(opens deal link)" className="mt-1 size-3.5 shrink-0 text-muted" />
        </a>
      </h3>

      {(deal.hidden_at || reports.length > 0) && (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-amber-200">
            {deal.hidden_at ? <EyeOff aria-hidden className="size-4" /> : <Flag aria-hidden className="size-4" />}
            {deal.hidden_at ? "Hidden from the site after reports" : "Reported by visitors"} · {reports.length}{" "}
            report{reports.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-amber-100/90">
            {reports.slice(0, 5).map((r, i) => (
              <li key={i}>
                {REPORT_REASONS[r.reason]}
                {r.note && <span className="text-amber-100/70">: “{r.note}”</span>}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            {deal.hidden_at ? (
              <form action={unhideDeal}>
                <input type="hidden" name="deal_id" value={deal.id} />
                <button className="rounded-lg border border-line px-3 py-1 text-fg hover:bg-white/5">
                  Deal is fine: unhide
                </button>
              </form>
            ) : (
              <form action={dismissReports}>
                <input type="hidden" name="deal_id" value={deal.id} />
                <button className="rounded-lg border border-line px-3 py-1 text-fg hover:bg-white/5">Dismiss reports</button>
              </form>
            )}
          </div>
        </div>
      )}

      {managedBy && (
        <p className="mt-1 text-xs text-amber-300">
          Managed by {managedBy}: edits are overwritten and deletions re-added on the next nightly run. Change the
          source instead.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <details className="rounded-xl border border-line open:bg-bg/40">
          <summary className="cursor-pointer list-none rounded-xl px-3 py-2 text-sm font-medium text-fg hover:bg-white/5 [&::-webkit-details-marker]:hidden">
            Edit…
          </summary>
          <div className="border-t border-line p-3">
            <DealForm
              action={updateDeal}
              hidden={{ deal_id: deal.id }}
              idPrefix={deal.id}
              submitLabel="Save changes"
              defaults={deal}
            />
          </div>
        </details>
        <details className="rounded-xl border border-line">
          <summary className="cursor-pointer list-none rounded-xl px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 [&::-webkit-details-marker]:hidden">
            Unpublish…
          </summary>
          <form action={deleteDeal} className="flex flex-wrap items-center gap-3 border-t border-line p-3 text-sm text-muted">
            <input type="hidden" name="deal_id" value={deal.id} />
            Removes it from the site permanently.
            <button className="rounded-lg bg-rose-500/90 px-3 py-1.5 font-medium text-white hover:bg-rose-500">
              Yes, unpublish
            </button>
          </form>
        </details>
      </div>
    </article>
  );
}
