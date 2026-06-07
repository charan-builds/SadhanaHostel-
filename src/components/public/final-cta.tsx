import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"

export function FinalCta() {
  return (
    <section className="bg-white px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border bg-slate-950 px-6 py-10 text-white shadow-xl shadow-slate-200/80 sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-blue-200">Visit or check availability</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Ready to visit {hostelConfig.name}?
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-300">
            Call or message the hostel team to ask about room availability and monthly stay plans.
          </p>
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:mt-0">
          <a
            href={callHref}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-slate-950 shadow-sm transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
            aria-label={`Call ${hostelConfig.name}`}
          >
            Call Now
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
            aria-label={`Message ${hostelConfig.name} on WhatsApp`}
          >
            WhatsApp
          </a>
        </div>
      </div>
    </section>
  )
}
