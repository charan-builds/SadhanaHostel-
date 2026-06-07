import { hostelConfig } from "@/constants/hostel"

const points = [
  "Safe stay",
  "Clean environment",
  "Students and employees",
  hostelConfig.location.note,
] as const

export function AboutPreview() {
  return (
    <section className="bg-slate-50 py-14 sm:py-16">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-blue-700">About the hostel</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 text-balance sm:text-4xl">
            A clean, practical stay in {hostelConfig.location.city}.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {hostelConfig.name} is designed for residents who need safe accommodation, a clean
            environment, daily essentials, and simple access to nearby education and work routes.
          </p>
          <a
            href="/about"
            className="mt-6 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            Learn More
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {points.map((point) => (
            <div key={point} className="rounded-xl border bg-white p-5 shadow-sm">
              <span className="block size-2 rounded-full bg-blue-700" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-slate-950">{point}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
