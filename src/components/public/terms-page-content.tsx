import { AlertTriangle, MessageCircle, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { termsAndRules } from "@/constants/public-content"

export function TermsPageContent() {
  return (
    <main className="flex flex-1 flex-col bg-white">
      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_76%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium text-blue-700">Terms and conditions</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
            Hostel rules for residents.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Please read the rules carefully before joining {hostelConfig.name}. These policies help
            keep the hostel disciplined and clear for every resident.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-4xl gap-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p className="text-sm leading-6">
                Residents and guardians should understand these rules before confirming a hostel
                stay.
              </p>
            </div>
          </div>

          {termsAndRules.map((rule, index) => (
            <article key={rule} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <p className="pt-1 text-base leading-7 text-slate-700">{rule}</p>
              </div>
            </article>
          ))}

          <div className="mt-4 rounded-2xl border bg-slate-950 p-6 text-white shadow-sm">
            <h2 className="text-2xl font-semibold">Questions about hostel rules?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Call or message the hostel before admission if you need clarification.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="bg-white text-slate-950 hover:bg-blue-50">
                <a href={callHref}>
                  <Phone className="size-4" aria-hidden="true" />
                  Call Now
                </a>
              </Button>
              <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white">
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
