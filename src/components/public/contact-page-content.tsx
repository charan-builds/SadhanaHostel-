import { MapPin, MessageCircle, Navigation, Phone } from "lucide-react"

import { ContactInquiryForm } from "@/components/forms/contact-inquiry-form"
import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, mapSearchHref, whatsappHref } from "@/constants/hostel"

export function ContactPageContent() {
  return (
    <main className="flex flex-1 flex-col bg-white">
      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_76%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium text-blue-700">Contact</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
            Contact {hostelConfig.name}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Call, WhatsApp, navigate, or send a simple inquiry to check room availability in{" "}
            {hostelConfig.location.city}.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-4">
            <article className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-slate-950">{hostelConfig.name}</h2>
              <div className="mt-5 grid gap-4 text-sm text-slate-700">
                <p className="flex gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true" />
                  <span>
                    {hostelConfig.location.address}
                    <span className="mt-1 block font-medium text-slate-950">
                      {hostelConfig.location.note}
                    </span>
                  </span>
                </p>
                <a href={callHref} className="flex w-fit items-center gap-3 hover:text-slate-950">
                  <Phone className="size-5 text-blue-700" aria-hidden="true" />
                  {hostelConfig.contact.phone}
                </a>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-fit items-center gap-3 hover:text-slate-950"
                >
                  <MessageCircle className="size-5 text-blue-700" aria-hidden="true" />
                  {hostelConfig.contact.whatsapp}
                </a>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <a href={callHref}>
                    <Phone className="size-4" aria-hidden="true" />
                    Call
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={whatsappHref} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" aria-hidden="true" />
                    WhatsApp
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={mapSearchHref} target="_blank" rel="noreferrer">
                    <Navigation className="size-4" aria-hidden="true" />
                    Navigate
                  </a>
                </Button>
              </div>
            </article>

            <article className="min-h-72 rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex h-full min-h-64 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#dbeafe_0%,#f8fafc_55%,#e2e8f0_100%)] text-center">
                <div className="max-w-sm px-6">
                  <MapPin className="mx-auto size-10 text-blue-700" aria-hidden="true" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-950">
                    Open location map
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use the Navigate button to open the hostel location.
                  </p>
                </div>
              </div>
            </article>
          </div>

          <ContactInquiryForm />
        </div>
      </section>
    </main>
  )
}
