import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/auth-actions";
import { ClaimButton } from "@/components/claim-button";
import { getActiveDeals } from "@/lib/deals";
import { getViewer } from "@/lib/claims";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Your account · ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16 pt-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading your account…</p>}>
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const { user, claimed } = await getViewer();
  if (!user) redirect("/login?next=/account");

  // Claimed deals that are still live; expired ones simply drop off.
  const claimedDeals = (await getActiveDeals()).filter((d) => claimed.has(d.id));

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">Your account</h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <form action={signOut}>
          <button className="rounded-lg border border-line px-3 py-1.5 text-sm text-fg hover:bg-white/5">Sign out</button>
        </form>
      </header>

      <section aria-labelledby="claimed" className="flex flex-col gap-3">
        <h2 id="claimed" className="font-semibold text-fg">
          Claimed deals <span className="tabular-nums text-muted">{claimedDeals.length}</span>
        </h2>
        <p className="text-sm text-muted">
          These are hidden from your feed. Undo one to see it again; deals drop off this list once they end.
        </p>
        {claimedDeals.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
            Nothing claimed yet. Use <span className="text-fg">Mark claimed</span> on any deal.{" "}
            <Link href="/" className="text-fg underline underline-offset-4">
              Browse deals
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {claimedDeals.map((deal) => (
              <li key={deal.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{deal.title}</p>
                  <p className="text-xs text-muted">{deal.merchant}</p>
                </div>
                <ClaimButton dealId={deal.id} dealTitle={deal.title} claimed />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
