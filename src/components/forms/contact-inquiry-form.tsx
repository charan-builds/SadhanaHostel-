"use client"

import { FormEvent, useRef, useState } from "react"
import { CheckCircle2, Loader2, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSubmitPublicInquiry } from "@/hooks"
import { hostelConfig } from "@/constants/hostel"
import {
  trackContactAction,
  trackLeadSubmission,
  trackRoomEnquirySubmission,
  trackWhatsAppClick,
} from "@/lib/analytics/google-analytics"
import { FrontendApiError } from "@/lib/api-client"

export type ContactInquiryFormContent = {
  title?: string | null
  subtitle?: string | null
  description?: string | null
  ctaText?: string | null
}

type InquiryFieldName = "name" | "phone" | "whatsappNumber"

type InquiryFieldErrors = Partial<Record<InquiryFieldName, string>>

const defaultLeadFormContent = {
  title: "Send an inquiry",
  subtitle: "Submit your details so the hostel team can call back and explain the joining process.",
  description: "Only three fields. The hostel office will call you back quickly.",
  ctaText: "Request callback",
}

export function ContactInquiryForm({
  content,
}: {
  content?: ContactInquiryFormContent
}) {
  const [submitted, setSubmitted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<InquiryFieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const submitInquiry = useSubmitPublicInquiry()
  const leadContent = {
    title: content?.title?.trim() || defaultLeadFormContent.title,
    subtitle: content?.subtitle?.trim() || defaultLeadFormContent.subtitle,
    description: content?.description?.trim() || defaultLeadFormContent.description,
    ctaText: content?.ctaText?.trim() || defaultLeadFormContent.ctaText,
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const form = event.currentTarget
    const fullName = readText(formData, "name")
    const phone = readText(formData, "phone")
    const whatsappNumber = readText(formData, "whatsappNumber")
    const company = readText(formData, "company")
    const validationErrors = validateInquiryForm({
      fullName,
      phone,
      whatsappNumber,
    })

    setSubmitted(false)
    setSubmitError(null)

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      focusFirstInvalidField(form, validationErrors)
      return
    }

    try {
      setFieldErrors({})
      await submitInquiry.mutateAsync({
        fullName,
        phone,
        whatsappNumber,
        email: undefined,
        residentType: "student",
        source: "website",
        company,
      })
      trackLeadSubmission({
        source: "website",
        form: "contact_inquiry",
        resident_type: "student",
      })
      trackRoomEnquirySubmission({
        source: "website",
        form: "contact_inquiry",
        resident_type: "student",
      })
      setSubmitted(true)
      form.reset()
      toast.success("Inquiry submitted. The hostel team will contact you soon.")
    } catch (error) {
      const message =
        error instanceof FrontendApiError && error.requestId
          ? `${error.message} Reference: ${error.requestId}`
          : error instanceof Error
            ? error.message
            : "Inquiry could not be submitted."
      setSubmitError(message)
      toast.error(message)
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChange={handleFormChange}
      noValidate
      aria-busy={submitInquiry.isPending}
      className="rounded-2xl border bg-card/95 p-4 shadow-lifted backdrop-blur-xl sm:p-6"
    >
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{leadContent.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{leadContent.subtitle}</p>
        <p className="mt-2 text-sm font-medium text-primary">{leadContent.description}</p>
      </div>

      <InquiryProcess />

      <div className="mt-6 grid gap-4">
        <div className="hidden" aria-hidden="true">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="Your name"
            autoComplete="name"
            className="h-14 rounded-xl text-base"
            required
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
          />
          <FieldError id="name-error" message={fieldErrors.name} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phone">Mobile Number</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Your mobile number"
            autoComplete="tel"
            inputMode="tel"
            className="h-14 rounded-xl text-base"
            required
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
          />
          <FieldError id="phone-error" message={fieldErrors.phone} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="whatsapp-number">WhatsApp Number</Label>
          <Input
            id="whatsapp-number"
            name="whatsappNumber"
            type="tel"
            placeholder="Your WhatsApp number"
            autoComplete="tel"
            inputMode="tel"
            className="h-14 rounded-xl text-base"
            required
            aria-invalid={Boolean(fieldErrors.whatsappNumber)}
            aria-describedby={fieldErrors.whatsappNumber ? "whatsapp-number-error" : undefined}
          />
          <FieldError id="whatsapp-number-error" message={fieldErrors.whatsappNumber} />
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {submitted ? (
          <div className="mt-4 rounded-lg border border-success/20 bg-success-surface px-3 py-2 text-sm text-success-foreground">
            Inquiry saved. For urgent joining questions, you can also WhatsApp the hostel directly.
          </div>
        ) : null}

        {submitError ? (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-3 z-10 mt-6 rounded-2xl bg-card/95 pt-2 backdrop-blur sm:static sm:bg-transparent sm:pt-0">
        <Button type="submit" className="h-14 w-full text-base" disabled={submitInquiry.isPending}>
          {submitInquiry.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {leadContent.ctaText}
        </Button>
      </div>

      <Button asChild variant="outline" className="mt-3 w-full">
        <a
          href={hostelConfig.links.whatsappHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            trackContactAction("whatsapp", "contact_inquiry_form")
            trackWhatsAppClick("contact_inquiry_form")
          }}
        >
          WhatsApp instead
        </a>
      </Button>
    </form>
  )

  function handleFormChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target

    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return
    }

    if (!target.name) {
      return
    }

    setSubmitted(false)
    setSubmitError(null)
    setFieldErrors((current) => {
      if (!(target.name in current)) {
        return current
      }

      const next = { ...current }
      delete next[target.name as InquiryFieldName]
      return next
    })
  }
}

function InquiryProcess() {
  const steps = [
    "Hostel office calls back",
    "Room and fee availability is confirmed",
    "Visit and complete admission",
  ]

  return (
    <div className="mt-5 grid gap-2 rounded-xl border bg-muted/35 p-3 text-xs text-muted-foreground sm:grid-cols-3">
      {steps.map((step, index) => (
        <div key={step} className="flex gap-2">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">Step {index + 1}: </span>
            {step}
          </span>
        </div>
      ))}
    </div>
  )
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

function validateInquiryForm(input: {
  fullName: string
  phone: string
  whatsappNumber: string
}): InquiryFieldErrors {
  const errors: InquiryFieldErrors = {}

  if (input.fullName.length < 2) {
    errors.name = "Enter your full name."
  }

  if (!isReasonablePhone(input.phone)) {
    errors.phone = "Enter a valid phone number."
  }

  if (!isReasonablePhone(input.whatsappNumber)) {
    errors.whatsappNumber = "Enter a valid WhatsApp number."
  }

  return errors
}

function isReasonablePhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 8 && digits.length <= 15
}

function focusFirstInvalidField(form: HTMLFormElement, errors: InquiryFieldErrors) {
  const firstInvalidField = Object.keys(errors)[0]

  if (!firstInvalidField) {
    return
  }

  const element = form.elements.namedItem(firstInvalidField)

  if (element instanceof HTMLElement) {
    element.focus()
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null
  }

  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  )
}
