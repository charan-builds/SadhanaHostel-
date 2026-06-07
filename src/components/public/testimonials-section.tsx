import { fallbackTestimonials } from "@/constants/public-content"

export function TestimonialsSection() {
  return (
    <section className="bg-muted/45 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-primary">Resident voices</p>
          <h2 className="text-gradient mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Built for a calm student routine.
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Simple rooms, clear pricing, and essentials that make hostel life easier.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {fallbackTestimonials.map((item) => (
            <article
              key={item.name}
              className="rounded-2xl border bg-card/90 p-6 shadow-soft backdrop-blur-xl"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-2xl font-semibold text-primary" aria-hidden="true">
                  &quot;
                </span>
                <span className="text-sm font-semibold text-warning">5 / 5</span>
              </div>
              <p className="mt-5 text-lg leading-8 text-foreground">
                &quot;{item.quote}&quot;
              </p>
              <div className="mt-5 border-t pt-4">
                <p className="font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.role}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
