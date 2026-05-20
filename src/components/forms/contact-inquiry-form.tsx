"use client"

import { FormEvent, useState } from "react"
import { Send } from "lucide-react"

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

export function ContactInquiryForm() {
  const [submitted, setSubmitted] = useState(false)
  const [residentType, setResidentType] = useState("student")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">Send an inquiry</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This is a UI-only form for now. It does not send data to a backend.
        </p>
      </div>

      <div className="mt-6 grid gap-4">
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
          <Label htmlFor="resident-type">Resident type interest</Label>
          <Select value={residentType} onValueChange={setResidentType}>
            <SelectTrigger id="resident-type" className="h-10 w-full">
              <SelectValue placeholder="Select resident type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
            </SelectContent>
          </Select>
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
        <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Inquiry preview submitted. Backend connection will be added later.
        </p>
      ) : null}

      <Button type="submit" className="mt-6 w-full">
        <Send className="size-4" aria-hidden="true" />
        Submit Inquiry
      </Button>
    </form>
  )
}
