import type { Metadata } from "next";
import { Suspense } from "react";
import { SITE_NAME } from "@/lib/site";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = {
  title: `Unsubscribe · ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-xl font-bold text-fg">Unsubscribe from deal alerts?</h1>
        <p className="mt-2 text-sm text-muted">You&apos;ll stop getting {SITE_NAME} emails. You can turn them back on anytime from your account.</p>
        <Suspense>
          <TokenForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function TokenForm({ searchParams }: Pick<PageProps<"/unsubscribe">, "searchParams">) {
  const { token } = await searchParams;
  return <UnsubscribeForm token={typeof token === "string" ? token : ""} />;
}
