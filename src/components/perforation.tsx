/**
 * The ticket motif: a dashed tear line with half-circle notches cut into
 * the card's edges. `inset` is the card's horizontal padding, so the notches
 * sit exactly on its border. Decorative only.
 */
export function Perforation({ inset = "-mx-4", className = "" }: { inset?: string; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none relative ${inset} ${className}`}>
      <div className="mx-3 border-t border-dashed border-line-strong" />
      <span className="absolute -left-2 -top-2 size-4 rounded-full border border-line bg-bg [clip-path:inset(0_0_0_50%)]" />
      <span className="absolute -right-2 -top-2 size-4 rounded-full border border-line bg-bg [clip-path:inset(0_50%_0_0)]" />
    </div>
  );
}
