export default function LoadingUpload() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-col items-center gap-3 sm:items-start">
        <div className="h-9 w-72 animate-pulse rounded-md bg-secondary" />
        <div className="h-5 w-full max-w-md animate-pulse rounded-md bg-secondary/60" />
      </div>

      <div className="flex flex-col gap-6 rounded-xl border border-border/80 bg-card px-5 py-6 sm:px-8 sm:py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-4 w-16 animate-pulse rounded-md bg-secondary/60" />
              <div className="h-10 animate-pulse rounded-md bg-secondary/60" />
            </div>
          ))}
        </div>

        <div className="h-36 animate-pulse rounded-xl border border-dashed border-border/80 bg-secondary/20" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-4 w-16 animate-pulse rounded-md bg-secondary/60" />
              <div className="h-10 animate-pulse rounded-md bg-secondary/60" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="h-4 w-12 animate-pulse rounded-md bg-secondary/60" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg border border-border/80 bg-secondary/20" />
            ))}
          </div>
        </div>

        <div className="h-28 animate-pulse rounded-md bg-secondary/60" />
      </div>

      <div className="mt-6 h-12 animate-pulse rounded-md bg-secondary" />
    </div>
  );
}
