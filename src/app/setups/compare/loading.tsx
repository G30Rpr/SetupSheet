export default function LoadingCompare() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6 h-5 w-40 animate-pulse rounded-md bg-secondary/60" />
      <div className="mb-6 h-9 w-64 animate-pulse rounded-md bg-secondary" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-border/60 bg-secondary/20" />
        ))}
      </div>
      <div className="mt-6 h-64 animate-pulse rounded-xl border border-border/60 bg-secondary/20" />
    </div>
  );
}
