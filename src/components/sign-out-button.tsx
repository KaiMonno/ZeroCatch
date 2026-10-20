"use client";

import { signOut } from "@/app/auth-actions";

/** Sign out, and drop the offline copies of pages that showed this person's claims. */
export function SignOutButton() {
  return (
    <form
      action={signOut}
      onSubmit={() => navigator.serviceWorker?.controller?.postMessage({ type: "clear-pages" })}
    >
      <button className="rounded-lg border border-line px-3 py-1.5 text-sm text-fg hover:bg-white/5">Sign out</button>
    </form>
  );
}
