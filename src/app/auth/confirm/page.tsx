import type { Metadata } from "next";
import { Suspense } from "react";
import { confirmEmailLink } from "@/app/auth-actions";
import { safeNextPath } from "@/lib/safe-next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Finish signing in · ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

/**
 * Where the sign-in email's link lands. It asks for one tap instead of
 * signing in on page load: mail security scanners open every link in an
 * email, and would otherwise use up the one-time link before the visitor does.
 * Works on any device, since nothing depends on the browser that asked.
 */
export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-xl font-bold text-fg">Finish signing in</h1>
        <p className="mt-2 text-sm text-muted">One tap and you&apos;re in. This link works once and expires after an hour.</p>
        <Suspense>
          <ConfirmForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function ConfirmForm({ searchParams }: Pick<PageProps<"/auth/confirm">, "searchParams">) {
  const sp = await searchParams;
  const value = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");
  return (
    <form action={confirmEmailLink} className="mt-5">
      <input type="hidden" name="token_hash" value={value("token_hash")} />
      <input type="hidden" name="type" value={value("type") || "email"} />
      <input type="hidden" name="next" value={safeNextPath(value("next"))} />
      <button
        disabled={!value("token_hash")}
        className="w-full rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60"
      >
        Continue to {SITE_NAME}
      </button>
    </form>
  );
}
