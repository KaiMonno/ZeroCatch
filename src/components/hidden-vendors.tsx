import { X } from "lucide-react";
import { setVendorHidden } from "@/app/claim-actions";

/** Chips for the vendors a visitor has hidden; each one unhides on tap. Works without JavaScript. */
export function HiddenVendors({ vendors, label = "Hidden:" }: { vendors: string[]; label?: string }) {
  if (vendors.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {label && <span className="text-muted">{label}</span>}
      {vendors.map((merchant) => (
        <form key={merchant} action={setVendorHidden}>
          <input type="hidden" name="merchant" value={merchant} />
          <input type="hidden" name="hidden" value="false" />
          <button
            aria-label={`Show ${merchant} deals again`}
            className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-fg hover:border-line-strong hover:bg-white/5"
          >
            {merchant}
            <X aria-hidden className="size-3 text-muted" />
          </button>
        </form>
      ))}
    </div>
  );
}
