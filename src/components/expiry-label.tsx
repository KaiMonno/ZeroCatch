import { Clock } from "lucide-react";
import { formatExpiry } from "@/lib/format";

export function ExpiryLabel({ expiresAt }: { expiresAt: string | null }) {
  const { label, urgent } = formatExpiry(expiresAt);
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${urgent ? "font-medium text-orange-300" : "text-muted"}`}
    >
      <Clock aria-hidden className="size-3.5" />
      {expiresAt ? (
        <time dateTime={expiresAt} title={new Date(expiresAt).toUTCString()}>
          {label}
        </time>
      ) : (
        label
      )}
    </span>
  );
}
