export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading deals"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 pb-16 pt-4 sm:pt-8"
    >
      <div className="h-11 animate-pulse rounded-2xl bg-surface" />
      <div className="h-10 animate-pulse rounded-xl bg-surface" />
      <div className="h-44 animate-pulse rounded-3xl bg-surface" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    </main>
  );
}
