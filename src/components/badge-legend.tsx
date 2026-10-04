import { ChevronDown, Info } from "lucide-react";
import { BADGES, Badge, type BadgeKind } from "./deal-badges";

const ORDER: BadgeKind[] = ["no-card", "account", "instant-cancel", "with-purchase", "card-required"];

export function BadgeLegend() {
  return (
    <details className="group rounded-2xl border border-line bg-surface/60 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <Info aria-hidden className="size-4" />
        What do the badges mean?
        <ChevronDown aria-hidden className="ml-auto size-4 transition-transform group-open:rotate-180" />
      </summary>
      <dl className="grid gap-3 border-t border-line px-4 py-4 sm:grid-cols-2">
        {ORDER.map((kind) => (
          <div key={kind} className="flex flex-col items-start gap-1">
            <dt>
              <Badge kind={kind} />
            </dt>
            <dd className="text-xs text-muted">{BADGES[kind].help}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
