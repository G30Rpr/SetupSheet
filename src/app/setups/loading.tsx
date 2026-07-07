export default function LoadingSetups() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <div className="h-9 w-64 animate-pulse rounded-md bg-secondary" />
        <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-md bg-secondary/60" />
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5">
          <div className="mb-4 h-10 w-full animate-pulse rounded-md bg-secondary/60" />
          <div className="mb-3 h-4 w-28 animate-pulse rounded-md bg-secondary/60" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-secondary/60" />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-28 animate-pulse rounded-md bg-secondary/60" />
          <div className="h-9 w-40 animate-pulse rounded-md bg-secondary/60" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-96 animate-pulse rounded-xl border border-border/60 bg-secondary/20"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
