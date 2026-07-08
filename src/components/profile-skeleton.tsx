/** Shared loading skeleton for /profile and /profile/[userId] -- same shape either way. */
export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center gap-5 rounded-xl border border-border/80 bg-card px-5 py-6 sm:px-8">
        <div className="size-16 shrink-0 animate-pulse rounded-full bg-secondary" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-7 w-40 animate-pulse rounded-md bg-secondary" />
          <div className="h-4 w-32 animate-pulse rounded-md bg-secondary/60" />
        </div>
        <div className="flex items-center gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="h-6 w-8 animate-pulse rounded-md bg-secondary" />
              <div className="h-3 w-12 animate-pulse rounded-md bg-secondary/60" />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-5 h-7 w-36 animate-pulse rounded-md bg-secondary" />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-96 animate-pulse rounded-xl border border-border/60 bg-secondary/20" />
        ))}
      </div>
    </div>
  );
}
