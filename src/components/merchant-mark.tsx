/** A merchant's initial on a tint derived from its name: quick to scan, no logos to license. */
export function MerchantMark({ merchant, size = "size-7" }: { merchant: string; size?: string }) {
  let hash = 0;
  for (const ch of merchant) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const initial = merchant.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase() || "•";
  return (
    <span
      aria-hidden
      className={`grid ${size} shrink-0 place-items-center rounded-lg font-display text-sm font-bold`}
      style={{ background: `hsl(${hue} 32% 18%)`, color: `hsl(${hue} 75% 78%)` }}
    >
      {initial}
    </span>
  );
}
