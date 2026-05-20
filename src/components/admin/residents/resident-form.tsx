"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
import { HOSTEL_FEES } from "@/constants/hostel"

const residentFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone number is required"),
  whatsappNumber: z.string().optional(),
  residentType: z.enum(["student", "employee"], {
    error: "Resident type is required",
  }),
  aadhaarNumber: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  emergencyContact: z.string().optional(),
  joiningDate: z.string().min(1, "Joining date is required"),
  roomNumber: z.string().optional(),
  feeAmount: z.number().positive("Fee amount is required"),
  notes: z.string().optional(),
})

type ResidentFormValues = z.infer<typeof residentFormSchema>

const defaultValues: ResidentFormValues = {
  fullName: "",
  phone: "",
  whatsappNumber: "",
  residentType: "student",
  aadhaarNumber: "",
  parentName: "",
  parentPhone: "",
  emergencyContact: "",
  joiningDate: "",
  roomNumber: "",
  feeAmount: HOSTEL_FEES.student,
  notes: "",
}

export function ResidentForm() {
  const [mockSubmitting, setMockSubmitting] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResidentFormValues>({
    resolver: zodResolver(residentFormSchema),
    defaultValues,
  })

  async function onSubmit() {
    setMockSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 700))
    setMockSubmitting(false)
    toast.success("Resident saved in mock mode. Backend connection will be added later.")
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border bg-background p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Resident Information</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add resident details for the future onboarding workflow. This form is UI-only.
        </p>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" {...register("fullName")} placeholder="Resident full name" />
          {errors.fullName ? <p className="text-xs text-red-600">{errors.fullName.message}</p> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" type="tel" {...register("phone")} placeholder="Phone number" />
          {errors.phone ? <p className="text-xs text-red-600">{errors.phone.message}</p> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="whatsappNumber">WhatsApp number</Label>
          <Input
            id="whatsappNumber"
            type="tel"
            {...register("whatsappNumber")}
            placeholder="WhatsApp number"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="residentType">Resident type</Label>
          <Controller
            control={control}
            name="residentType"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  setValue(
                    "feeAmount",
                    value === "employee" ? HOSTEL_FEES.employee : HOSTEL_FEES.student,
                    { shouldValidate: true },
                  )
                }}
              >
                <SelectTrigger id="residentType" className="h-9 w-full">
                  <SelectValue placeholder="Select resident type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.residentType ? (
            <p className="text-xs text-red-600">{errors.residentType.message}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="aadhaarNumber">Aadhaar number</Label>
          <Input id="aadhaarNumber" {...register("aadhaarNumber")} placeholder="Aadhaar number" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="parentName">Parent name</Label>
          <Input id="parentName" {...register("parentName")} placeholder="Parent name" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="parentPhone">Parent phone</Label>
          <Input id="parentPhone" type="tel" {...register("parentPhone")} placeholder="Parent phone" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="emergencyContact">Emergency contact</Label>
          <Input
            id="emergencyContact"
            type="tel"
            {...register("emergencyContact")}
            placeholder="Emergency contact"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="joiningDate">Joining date</Label>
          <Input id="joiningDate" type="date" {...register("joiningDate")} />
          {errors.joiningDate ? (
            <p className="text-xs text-red-600">{errors.joiningDate.message}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="roomNumber">Room selection</Label>
          <Input id="roomNumber" {...register("roomNumber")} placeholder="Example: S-204" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="feeAmount">Fee amount</Label>
          <Input id="feeAmount" type="number" {...register("feeAmount", { valueAsNumber: true })} />
          {errors.feeAmount ? (
            <p className="text-xs text-red-600">{errors.feeAmount.message}</p>
          ) : null}
        </div>

        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            {...register("notes")}
            placeholder="Resident notes or onboarding context"
            className="min-h-28"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline">
          Cancel Placeholder
        </Button>
        <Button type="submit" disabled={mockSubmitting}>
          {mockSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Save Resident
        </Button>
      </div>
    </form>
  )
}
