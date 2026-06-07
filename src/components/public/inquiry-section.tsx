import Image from "next/image"

import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { hostelImages } from "@/constants/hostel-images"

export function InquirySection() {
  return (
    <section className="bg-background py-14 sm:py-20" id="inquiry">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
        <div
          className="overflow-hidden rounded-2xl border bg-sidebar text-sidebar-foreground shadow-lifted"
        >
          <div className="relative aspect-[4/3]">
            <Image
              src={hostelImages.exterior}
              alt="Sadhana Boys Hostel view"
              fill
              className="object-cover"
              loading="lazy"
              sizes="(min-width: 1024px) 45vw, 100vw"
            />
            <div className="absolute inset-0 bg-linear-to-t from-slate-950/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 p-6">
              <p className="text-sm font-medium text-cyan-100">Visit or contact</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Speak with the hostel office before you visit.
              </h2>
            </div>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            <ContactPill label="Call" value={hostelConfig.contact.phone} href={callHref} />
            <ContactPill label="WhatsApp" value="Message" href={whatsappHref} />
            <ContactPill label="Location" value={hostelConfig.location.city} href={hostelConfig.links.mapSearchHref} />
          </div>
        </div>

        <div>
          <div className="rounded-2xl border bg-card/95 p-6 shadow-lifted">
            <p className="text-sm font-medium text-primary">Quick inquiry</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              Share your joining details with the hostel office.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The full inquiry form is available on the contact page. You can also call or WhatsApp
              directly for faster room availability questions.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <a
                href="/contact"
                className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                Open inquiry form
              </a>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center justify-center rounded-lg border border-border/80 bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                WhatsApp
              </a>
            </div>
            <div className="mt-6 grid gap-3 rounded-xl border bg-muted/35 p-4 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Phone:</span>{" "}
                {hostelConfig.contact.phone}
              </p>
              <p>
                <span className="font-medium text-foreground">Location:</span>{" "}
                {hostelConfig.location.note}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactPill({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href: string
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="rounded-xl border border-white/10 bg-white/[0.08] p-3 transition-colors hover:bg-white/[0.12]"
    >
      <span className="block size-2 rounded-full bg-cyan-200" aria-hidden="true" />
      <p className="mt-3 text-xs text-sidebar-foreground/55">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </a>
  )
}
