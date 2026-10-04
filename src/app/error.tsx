"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <h1 className="text-lg font-semibold text-fg">Couldn&apos;t load deals</h1>
      <p className="text-sm text-muted">The deal feed is temporarily unavailable.</p>
      <button
        onClick={reset}
        className="rounded-xl bg-fg px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
      >
        Try again
      </button>
    </main>
  );
}
