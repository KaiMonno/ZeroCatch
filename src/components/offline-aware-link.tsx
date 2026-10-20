"use client";

import Link from "next/link";
import { useIsOffline } from "@/lib/use-is-offline";
import type { ComponentProps } from "react";

/**
 * A next/link that becomes a plain <a> while offline. Online, client-side
 * navigation is fastest; offline, Next.js would wait for the connection, but a
 * full page load lets the service worker answer from its saved copy instantly.
 */
type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function OfflineAwareLink({ scroll, prefetch, replace, ...props }: Props) {
  const offline = useIsOffline();
  if (offline) return <a {...props} />;
  return <Link scroll={scroll} prefetch={prefetch} replace={replace} {...props} />;
}
