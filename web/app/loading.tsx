/** Route-level skeleton: staggered shimmer blocks instead of a spinner. */
const rows = [0, 1, 2, 3, 4, 5];
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 rounded-lg bg-zinc-800 animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[300px] rounded-xl hairline bg-panel animate-pulse" style={{ animationDelay: '80ms' }} />
        <div className="h-[300px] rounded-xl hairline bg-panel animate-pulse" style={{ animationDelay: '160ms' }} />
      </div>
      <div className="rounded-xl hairline bg-panel p-4 space-y-2">
        {rows.map((i) => (
          <div key={i} className="h-12 rounded-lg bg-zinc-800/70 animate-pulse" style={{ animationDelay: `${i * 70}ms` }} />
        ))}
      </div>
    </main>
  );
}
