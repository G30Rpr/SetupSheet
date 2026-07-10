export default function LoadingRequests() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <div className="h-9 w-64 animate-pulse rounded-md bg-secondary" />
        <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-md bg-secondary/60" />
      </div>

      <div className="mb-8 h-32 animate-pulse rounded-xl border border-border/60 bg-secondary/20" />
      <div className="mb-8 h-56 animate-pulse rounded-xl border border-border/60 bg-secondary/20" />

      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border/60 bg-secondary/20" />
        ))}
      </div>
    </div>
  );
}
