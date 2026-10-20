import { LiveExpiry } from "./live-expiry";

/** Server-rendered expiry label; the client keeps it current (see LiveExpiry). */
export function ExpiryLabel({ expiresAt }: { expiresAt: string | null }) {
  // A Server Component renders once per request, and recording that moment is
  // the point: the client hydrates with it, then switches to its own clock.
  // eslint-disable-next-line react-hooks/purity
  return <LiveExpiry expiresAt={expiresAt} renderedAt={Date.now()} />;
}
