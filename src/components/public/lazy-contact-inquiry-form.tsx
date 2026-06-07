"use client"

import dynamic from "next/dynamic"

import { AppQueryProvider } from "@/lib/react-query"

const ContactInquiryForm = dynamic(
  () =>
    import("@/components/forms/contact-inquiry-form").then(
      (mod) => mod.ContactInquiryForm
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[62rem] rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        Loading inquiry form...
      </div>
    ),
  }
)

export function LazyContactInquiryForm() {
  return (
    <AppQueryProvider>
      <ContactInquiryForm />
    </AppQueryProvider>
  )
}
