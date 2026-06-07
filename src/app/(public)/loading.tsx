export default function PublicLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
    </main>
  )
}
