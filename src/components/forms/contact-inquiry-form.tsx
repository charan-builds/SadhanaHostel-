"use client"

import { FormEvent, useState } from "react"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useSubmitPublicInquiry } from "@/hooks"
import { hostelConfig } from "@/constants/hostel"
import {
  trackContactAction,
  trackLeadSubmission,
  trackRoomEnquirySubmission,
  trackWhatsAppClick,
} from "@/lib/analytics/google-analytics"
import type { ResidentType } from "@/types/admissions"

type ContactInquiryFormProps = {
  variant?: "full" | "homepage"
}

export function ContactInquiryForm({ variant = "full" }: ContactInquiryFormProps) {
  const [submitted, setSubmitted] = useState(false)
  const [residentType, setResidentType] = useState<ResidentType>("student")
  const submitInquiry = useSubmitPublicInquiry()
  const isHomepageVariant = variant === "homepage"

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const form = event.currentTarget
    const fullName = String(formData.get("name") ?? "")
    const phone = String(formData.get("phone") ?? "")
    const whatsappNumber = String(formData.get("whatsappNumber") ?? "") || undefined
    const email = String(formData.get("email") ?? "") || undefined
    const desiredJoiningDate = String(formData.get("desiredJoiningDate") ?? "") || undefined
    const expectedStayDuration = String(formData.get("expectedStayDuration") ?? "") || undefined
    const parentPhone = String(formData.get("parentPhone") ?? "") || undefined
    const message = String(formData.get("message") ?? "")
    const company = String(formData.get("company") ?? "")

    try {
      await submitInquiry.mutateAsync({
        fullName,
        phone,
        whatsappNumber,
        email,
        residentType,
        desiredJoiningDate,
        expectedStayDuration,
        parentPhone,
        notes: message || undefined,
        source: "website",
        company,
      })
      trackLeadSubmission({
        source: "website",
        form: "contact_inquiry",
        resident_type: residentType,
      })
      trackRoomEnquirySubmission({
        source: "website",
        form: "contact_inquiry",
        resident_type: residentType,
      })
      setSubmitted(true)
      form.reset()
      setResidentType("student")
      toast.success("Inquiry submitted. The hostel team will contact you soon.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Inquiry could not be submitted.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border bg-card/95 p-6 shadow-lifted backdrop-blur-xl">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          {isHomepageVariant ? "Send an Inquiry" : "Send an inquiry"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isHomepageVariant
            ? "Share your details and our hostel team will contact you."
            : "Submit your details so the hostel team can call back and explain the joining process."}
        </p>
      </div>

      <div className={isHomepageVariant ? "mt-7 grid gap-5" : "mt-6 grid gap-4"}>
        <div className="hidden" aria-hidden="true">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="name">{isHomepageVariant ? "Full Name" : "Name"}</Label>
          <Input
            id="name"
            name="name"
            placeholder={isHomepageVariant ? "Enter your full name" : "Your name"}
            autoComplete="name"
            className={isHomepageVariant ? "h-12" : undefined}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phone">{isHomepageVariant ? "Mobile Number" : "Phone number"}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder={isHomepageVariant ? "Enter your mobile number" : "Your phone number"}
            autoComplete="tel"
            className={isHomepageVariant ? "h-12" : undefined}
            required
          />
        </div>

        {isHomepageVariant ? null : (
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Optional email address"
              autoComplete="email"
            />
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="whatsapp-number">
            {isHomepageVariant ? "WhatsApp Number" : "WhatsApp number"}
          </Label>
          <Input
            id="whatsapp-number"
            name="whatsappNumber"
            type="tel"
            placeholder={isHomepageVariant ? "Enter your WhatsApp number" : "Optional WhatsApp number"}
            autoComplete="tel"
            className={isHomepageVariant ? "h-12" : undefined}
          />
        </div>

        {isHomepageVariant ? null : (
          <>
            <div className="grid gap-2">
              <Label htmlFor="resident-type">Resident type interest</Label>
              <Select
                value={residentType}
                onValueChange={(value) => setResidentType(value as ResidentType)}
              >
                <SelectTrigger id="resident-type" className="h-10 w-full">
                  <SelectValue placeholder="Select resident type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="joining-date">Desired joining date</Label>
              <Input id="joining-date" name="desiredJoiningDate" type="date" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stay-duration">Expected stay duration</Label>
              <Input
                id="stay-duration"
                name="expectedStayDuration"
                placeholder="Example: 6 months"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="parent-phone">Parent contact</Label>
              <Input
                id="parent-phone"
                name="parentPhone"
                type="tel"
                placeholder="Optional parent phone number"
                autoComplete="tel"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                placeholder="Tell us your joining date or any questions for the hostel office"
                className="min-h-28"
              />
            </div>
          </>
        )}
      </div>

      {submitted ? (
        <div className="mt-4 rounded-lg border border-success/20 bg-success-surface px-3 py-2 text-sm text-success-foreground">
          Inquiry saved. For urgent joining questions, you can also WhatsApp the hostel directly.
        </div>
      ) : null}

      <Button
        type="submit"
        className={isHomepageVariant ? "mt-6 h-12 w-full text-base" : "mt-6 w-full"}
        disabled={submitInquiry.isPending}
      >
        {submitInquiry.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        {isHomepageVariant ? "Request Callback" : "Submit inquiry"}
      </Button>

      <Button
        asChild
        variant="outline"
        className={isHomepageVariant ? "mt-3 h-12 w-full text-base" : "mt-3 w-full"}
      >
        <a
          href={hostelConfig.links.whatsappHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            trackContactAction("whatsapp", "contact_inquiry_form")
            trackWhatsAppClick("contact_inquiry_form")
          }}
        >
          {isHomepageVariant ? "Contact on WhatsApp" : "WhatsApp instead"}
        </a>
      </Button>
    </form>
  )
}
