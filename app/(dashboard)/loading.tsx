export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto opacity-90">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-[var(--muted)] animate-pulse" />
        <div className="h-4 w-full max-w-md rounded bg-[var(--muted)]/70 animate-pulse" />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
        <div className="h-5 w-32 rounded bg-[var(--muted)] animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-[var(--muted)]/80 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
        <div className="h-5 w-40 rounded bg-[var(--muted)] animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-[var(--muted)]/80 animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
