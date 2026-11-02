import type { CSSProperties } from "react";

/** Entrance delay for the i-th item in a list, so cards rise in one after another. Capped so long lists don't keep you waiting. */
export function stagger(i: number, stepMs = 45): CSSProperties {
  return { animationDelay: `${Math.min(i, 9) * stepMs}ms` };
}
