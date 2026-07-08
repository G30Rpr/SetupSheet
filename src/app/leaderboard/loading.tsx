export default function LoadingLeaderboard() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <div className="h-9 w-72 animate-pulse rounded-md bg-secondary" />
        <div className="mt-3 h-5 w-full max-w-md animate-pulse rounded-md bg-secondary/60" />
      </div>

      <div className="divide-y divide-border/80 rounded-xl border border-border/80 bg-card">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="size-8 shrink-0 animate-pulse rounded-full bg-secondary" />
            <div className="size-10 shrink-0 animate-pulse rounded-full bg-secondary" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-4 w-32 animate-pulse rounded-md bg-secondary" />
              <div className="h-3 w-20 animate-pulse rounded-md bg-secondary/60" />
            </div>
            <div className="h-5 w-12 shrink-0 animate-pulse rounded-md bg-secondary/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
