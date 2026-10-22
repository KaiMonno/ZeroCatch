"use client";

import { MoreHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { ClaimButton } from "./claim-button";
import { HideVendorButton } from "./hide-vendor-button";
import { ReportDeal } from "./report-deal";

/**
 * A deal's footer: time left, "Mark claimed", and a ⋯ button that reveals the
 * less common actions (hide this vendor, report a problem) in a panel below,
 * so they're one tap away without crowding every card.
 */
export function CardActions({
  dealId,
  dealTitle,
  merchant,
  claimed,
  lead,
}: {
  dealId: string;
  dealTitle: string;
  merchant: string;
  claimed: boolean;
  /** Left side of the row: the countdown, or the hero's claim button and countdown. */
  lead: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="relative z-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">{lead}</div>
        <div className="ml-auto flex items-center gap-1">
          <ClaimButton dealId={dealId} dealTitle={dealTitle} claimed={claimed} />
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`More options for ${dealTitle}`}
            onClick={() => setOpen((o) => !o)}
            className={`grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-fg ${open ? "bg-white/5 text-fg" : ""}`}
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      {/* Kept mounted while closed so a half-written report isn't lost. */}
      <div id={panelId} hidden={!open} className="mt-3 flex flex-col items-start gap-3 rounded-xl bg-bg/60 p-3">
        <HideVendorButton merchant={merchant} />
        <ReportDeal dealId={dealId} dealTitle={dealTitle} />
      </div>
    </div>
  );
}
