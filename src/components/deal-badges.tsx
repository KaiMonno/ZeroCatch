import { CreditCard, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import type { Deal } from "@/lib/types";

export type BadgeKind = "no-card" | "card-required" | "account" | "instant-cancel";

/** `tone` tints the icon; only "card required" also tints its text, since that's the one to notice. */
export const BADGES: Record<BadgeKind, { label: string; icon: LucideIcon; tone: string; text?: string; help: string }> = {
  "no-card": {
    label: "No Credit Card Required",
    icon: CreditCard,
    tone: "bg-emerald-400/15 text-emerald-300",
    help: "You never enter a payment method.",
  },
  account: {
    label: "Account Required",
    icon: UserRound,
    tone: "bg-amber-400/15 text-amber-300",
    help: "Needs a free sign-up or app login.",
  },
  "instant-cancel": {
    label: "Instant-Cancel Safe",
    icon: ShieldCheck,
    tone: "bg-sky-400/15 text-sky-300",
    help: "Cancel right after signing up and keep the full trial.",
  },
  "card-required": {
    label: "Card Required at Signup",
    icon: CreditCard,
    tone: "bg-rose-400/15 text-rose-300",
    text: "text-rose-200",
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
  const { label, icon: Icon, tone, text } = BADGES[kind];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text ?? "text-fg/85"}`}>
      <span className={`grid size-[18px] place-items-center rounded-full ${tone}`}>
        <Icon aria-hidden className="size-[11px]" />
      </span>
      {label}
    </span>
  );
}

export function DealBadges({ deal }: { deal: Deal }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Deal requirements">
      {badgesFor(deal).map((kind) => (
        <li key={kind}>
          <Badge kind={kind} />
        </li>
      ))}
    </ul>
  );
}
