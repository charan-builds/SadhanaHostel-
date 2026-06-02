import { fallbackFaqItems } from "@/constants/public-content"

export function SeoFaqSection() {
  return (
    <section className="bg-background py-14 sm:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-primary">Pulivendula hostel FAQ</p>
          <h2 className="text-gradient mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Common questions before joining Sadhana Boys Hostel.
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Quick answers about student rooms, employee accommodation, fees, facilities, and
            hostel rules in Pulivendula.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {fallbackFaqItems.map((item) => (
            <article key={item.question} className="rounded-xl border bg-card p-5 shadow-soft">
              <h3 className="text-base font-semibold text-foreground">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
