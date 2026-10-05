import { CreditCard, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import type { Deal } from "@/lib/types";

export type BadgeKind = "no-card" | "card-required" | "account" | "instant-cancel";

export const BADGES: Record<BadgeKind, { label: string; icon: LucideIcon; className: string; help: string }> = {
  "no-card": {
    label: "No Credit Card Required",
    icon: CreditCard,
    className: "bg-emerald-500/12 text-emerald-300 ring-emerald-400/25",
    help: "You never enter a payment method.",
  },
  account: {
    label: "Account Required",
    icon: UserRound,
    className: "bg-amber-500/12 text-amber-300 ring-amber-400/25",
    help: "Needs a free sign-up or app login.",
  },
  "instant-cancel": {
    label: "Instant-Cancel Safe",
    icon: ShieldCheck,
    className: "bg-sky-500/12 text-sky-300 ring-sky-400/25",
    help: "Cancel right after signing up and keep the full trial.",
  },
  "card-required": {
    label: "Card Required at Signup",
    icon: CreditCard,
    className: "bg-rose-500/10 text-rose-300 ring-rose-400/25",
    help: "Asks for a card up front. Set a reminder or cancel immediately.",
  },
};

export function badgesFor(deal: Deal): BadgeKind[] {
  const kinds: BadgeKind[] = [deal.requires_credit_card ? "card-required" : "no-card"];
  if (deal.requires_account) kinds.push("account");
  if (deal.instant_cancel_safe) kinds.push("instant-cancel");
  return kinds;
}

export function Badge({ kind }: { kind: BadgeKind }) {
  const { label, icon: Icon, className } = BADGES[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}
    >
      <Icon aria-hidden className="size-3" />
      {label}
    </span>
  );
}

export function DealBadges({ deal }: { deal: Deal }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Deal requirements">
      {badgesFor(deal).map((kind) => (
        <li key={kind}>
          <Badge kind={kind} />
        </li>
      ))}
    </ul>
  );
}
