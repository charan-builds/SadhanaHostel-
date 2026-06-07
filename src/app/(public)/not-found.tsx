export default function PublicNotFound() {
  return (
    <main className="mx-auto flex min-h-[60svh] w-full max-w-3xl items-center px-4 py-12">
      <section className="w-full rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm font-medium text-primary">Page not found</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          The public page you are looking for does not exist.
        </h1>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="mt-6 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          Go home
        </a>
      </section>
    </main>
  )
}
