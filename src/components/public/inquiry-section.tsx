"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { MapPin, MessageCircle, Phone, type LucideIcon } from "lucide-react"

import { ContactInquiryForm } from "@/components/forms/contact-inquiry-form"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { hostelImages } from "@/constants/hostel-images"
import {
  trackContactAction,
  trackWhatsAppClick,
} from "@/lib/analytics/google-analytics"
import type { LeadFormContent } from "@/types/frontend"

export function InquirySection({ leadForm }: { leadForm?: LeadFormContent }) {
  const imageUrl = leadForm?.imageUrl || hostelImages.exterior

  return (
    <section className="bg-background py-14 sm:py-20" id="inquiry">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
        <motion.div
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-2xl border bg-sidebar text-sidebar-foreground shadow-lifted"
        >
          <div className="relative aspect-[4/3]">
            <Image
              src={imageUrl}
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
                {leadForm?.title || "Speak with the hostel office before you visit."}
              </h2>
            </div>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            <ContactPill icon={Phone} label="Call" value={hostelConfig.contact.phone} href={callHref} />
            <ContactPill icon={MessageCircle} label="WhatsApp" value="Message" href={whatsappHref} />
            <ContactPill icon={MapPin} label="Location" value={hostelConfig.location.city} href={hostelConfig.links.mapSearchHref} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <ContactInquiryForm content={leadForm} />
        </motion.div>
      </div>
    </section>
  )
}

function ContactPill({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon
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
      onClick={() => {
        const method = label === "WhatsApp" ? "whatsapp" : label === "Call" ? "phone" : "map"

        trackContactAction(method, "home_inquiry_section")

        if (method === "whatsapp") {
          trackWhatsAppClick("home_inquiry_section")
        }
      }}
    >
      <Icon className="size-4 text-cyan-200" aria-hidden="true" />
      <p className="mt-3 text-xs text-sidebar-foreground/55">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </a>
  )
}
