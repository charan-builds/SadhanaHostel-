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
import { usePublicVacancy, useSubmitPublicInquiry } from "@/hooks"
import { hostelConfig } from "@/constants/hostel"
import type { ResidentType } from "@/types/admissions"

export function ContactInquiryForm() {
  const [submitted, setSubmitted] = useState(false)
  const [residentType, setResidentType] = useState<ResidentType>("student")
  const vacancy = usePublicVacancy()
  const submitInquiry = useSubmitPublicInquiry()
  const availableVacancies = vacancy.data?.summary?.available_beds

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
      setSubmitted(true)
      form.reset()
      setResidentType("student")
      toast.success("Inquiry submitted. The hostel team will contact you soon.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Inquiry could not be submitted.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">Send an inquiry</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Submit your details so the hostel can check vacancy, follow up, and reserve a room if
          suitable.
        </p>
        <VacancyNotice
          isLoading={vacancy.isLoading}
          availableVacancies={availableVacancies}
        />
      </div>

      <div className="mt-6 grid gap-4">
        <div className="hidden" aria-hidden="true">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Your name" autoComplete="name" required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Your phone number"
            autoComplete="tel"
            required
          />
        </div>

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

        <div className="grid gap-2">
          <Label htmlFor="whatsapp-number">WhatsApp number</Label>
          <Input
            id="whatsapp-number"
            name="whatsappNumber"
            type="tel"
            placeholder="Optional WhatsApp number"
            autoComplete="tel"
          />
        </div>

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
            placeholder="Tell us what kind of room you are looking for"
            className="min-h-28"
          />
        </div>
      </div>

      {submitted ? (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Inquiry saved. For urgent booking checks, you can also WhatsApp the hostel directly.
        </div>
      ) : null}

      <Button type="submit" className="mt-6 w-full" disabled={submitInquiry.isPending}>
        {submitInquiry.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        Submit Inquiry
      </Button>

      <Button asChild variant="outline" className="mt-3 w-full">
        <a href={hostelConfig.links.whatsappHref} target="_blank" rel="noreferrer">
          WhatsApp instead
        </a>
      </Button>
    </form>
  )
}

function VacancyNotice({
  isLoading,
  availableVacancies,
}: {
  isLoading: boolean
  availableVacancies?: number
}) {
  if (isLoading) {
    return (
      <p className="mt-4 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Checking live vacancy...
      </p>
    )
  }

  if (typeof availableVacancies !== "number") {
    return (
      <p className="mt-4 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Vacancy will be confirmed after the hostel team reviews your inquiry.
      </p>
    )
  }

  return (
    <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
      {availableVacancies > 0
        ? `Student Vacancy: ${availableVacancies}`
        : "Currently full. Join the waitlist."}
    </p>
  )
}
