"use client"

import { useEffect, useState } from "react"
import type { Route } from "next"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  IdCard,
  Loader2,
  Send,
  UserRound,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { FrontendApiError } from "@/lib/api-client"
import { HOSTEL_RULES, HOSTEL_RULES_VERSION } from "@/constants/hostel"
import {
  useDocumentUpload,
  useProfilePhotoUpload,
  useResidentOnboarding,
  useSubmitResidentOnboarding,
  useUpdateResidentOnboardingProfile,
} from "@/hooks"
import {
  onboardingProfileFormSchema,
  type OnboardingProfileInput,
} from "@/validations/onboarding.validation"

const formSchema = onboardingProfileFormSchema
type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

const missingLabels: Record<string, string> = {
  full_name: "Full name",
  date_of_birth: "Date of birth",
  phone: "Phone",
  guardian: "Guardian details",
  emergency_contact: "Emergency contact",
  permanent_address: "Permanent address",
  aadhaar_document: "Aadhaar document",
  profile_photo: "Profile photo",
  student_id: "Student ID",
  room_allocation: "Room allocation",
  rules_acceptance: "Hostel rules acceptance",
}

export function ResidentOnboardingClient() {
  const { organizationId } = useAuth()
  const onboarding = useResidentOnboarding(organizationId)
  const updateProfile = useUpdateResidentOnboardingProfile()
  const submitOnboarding = useSubmitResidentOnboarding()
  const aadhaarUpload = useDocumentUpload()
  const studentIdUpload = useDocumentUpload()
  const photoUpload = useProfilePhotoUpload()
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null)
  const [studentIdFile, setStudentIdFile] = useState<File | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [rulesAcceptedOverride, setRulesAcceptedOverride] = useState(false)
  const [uploadRecoveryMessage, setUploadRecoveryMessage] = useState<string | null>(null)

  const resident = onboarding.data?.resident
  const requirements = onboarding.data?.requirements
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      preferredName: "",
      gender: "",
      dateOfBirth: "",
      phone: "",
      email: "",
      parentName: "",
      parentPhone: "",
      parentEmail: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      permanentAddress: "",
      aadhaarLast4: "",
      collegeName: "",
      courseName: "",
      guardianRelation: "",
    },
  })

  useEffect(() => {
    if (!resident) {
      return
    }

    const onboardingMeta =
      resident.metadata &&
      typeof resident.metadata === "object" &&
      !Array.isArray(resident.metadata)
        ? (resident.metadata.onboarding as Record<string, unknown> | undefined)
        : undefined

    form.reset({
      fullName: resident.full_name ?? "",
      preferredName: resident.preferred_name ?? "",
      gender: resident.gender ?? "",
      dateOfBirth: resident.date_of_birth ?? "",
      phone: resident.phone ?? "",
      email: resident.email ?? "",
      parentName: resident.parent_name ?? "",
      parentPhone: resident.parent_phone ?? "",
      parentEmail: resident.parent_email ?? "",
      emergencyContactName: resident.emergency_contact_name ?? "",
      emergencyContactPhone: resident.emergency_contact_phone ?? "",
      permanentAddress: resident.permanent_address ?? "",
      aadhaarLast4: resident.aadhaar_last4 ?? "",
      collegeName: String(onboardingMeta?.collegeName ?? ""),
      courseName: String(onboardingMeta?.courseName ?? ""),
      guardianRelation: String(onboardingMeta?.guardianRelation ?? ""),
    })
  }, [form, resident])

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization assignment pending"
        message="Ask the hostel admin to finish linking your account before onboarding."
      />
    )
  }

  if (onboarding.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (onboarding.isError || !resident || !requirements) {
    return (
      <APIErrorState
        title="Onboarding could not be loaded"
        error={onboarding.error}
        onRetry={() => void onboarding.refetch()}
      />
    )
  }

  const onboardingComplete = requirements.canAccessResidentOperations
  const rulesAccepted =
    rulesAcceptedOverride || hasAcceptedCurrentHostelRules(resident)
  const effectiveMissing = requirements.missing.filter(
    (item) => item !== "rules_acceptance" || !rulesAccepted
  )
  const canFinishOnboarding = effectiveMissing.length === 0

  async function saveProfile(values: FormValues) {
    if (!organizationId) {
      return
    }

    try {
      await updateProfile.mutateAsync({
        organizationId,
        ...values,
      } satisfies OnboardingProfileInput)
      await onboarding.refetch()
      toast.success("Onboarding profile saved.")
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to save onboarding profile. Please retry.",
      })
    }
  }

  async function uploadFile(kind: "aadhaar" | "student_id" | "photo") {
    if (!organizationId || !resident) {
      return
    }

    try {
      setUploadRecoveryMessage(null)

      if (kind === "photo" && photoFile) {
        await photoUpload.mutateAsync({
          input: {
            organizationId,
            hostelId: resident.hostel_id,
            residentId: resident.id,
          },
          file: photoFile,
        })
      }

      if (kind === "aadhaar" && aadhaarFile) {
        await aadhaarUpload.mutateAsync({
          input: {
            organizationId,
            hostelId: resident.hostel_id,
            residentId: resident.id,
            documentType: "aadhaar",
            isPublic: false,
          },
          file: aadhaarFile,
        })
      }

      if (kind === "student_id" && studentIdFile) {
        await studentIdUpload.mutateAsync({
          input: {
            organizationId,
            hostelId: resident.hostel_id,
            residentId: resident.id,
            documentType: "student_id",
            isPublic: false,
          },
          file: studentIdFile,
        })
      }

      await onboarding.refetch()
      toast.success("Document uploaded.")
    } catch {
      setUploadRecoveryMessage(
        "Upload did not complete. Check your connection, use a supported file type, and retry. Staff can help from support if it keeps failing."
      )
      toast.error("Upload failed. Retry or open support.")
    }
  }

  async function submitForVerification() {
    if (!organizationId) {
      return
    }

    if (!rulesAccepted) {
      form.setError("root", {
        message: "Accept hostel rules and regulations before continuing.",
      })
      return
    }

    try {
      await submitOnboarding.mutateAsync({ organizationId, rulesAccepted: true })
      await onboarding.refetch()
      toast.success("Onboarding complete. Your dashboard is ready.")
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to complete onboarding. Please retry.",
      })
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="gap-4 lg:grid lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <CardTitle>Resident Onboarding</CardTitle>
            <CardDescription>
              Complete your profile and upload required documents. Payments can be
              submitted now; leave, notices, invoices, and dashboard actions unlock
              when everything is complete.
            </CardDescription>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            <p className="font-medium">{requirements.completionPercent}% complete</p>
            <div className="mt-2 h-2 w-44 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-blue-600"
                style={{ width: `${requirements.completionPercent}%` }}
              />
            </div>
            <div className="mt-3">
              <StatusBadge status={requirements.status} />
            </div>
          </div>
        </CardHeader>
        {requirements.status === "rejected" ? (
          <CardContent>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="mb-2 size-4" aria-hidden="true" />
              {resident.onboarding_rejection_reason ||
                "Your onboarding was rejected. Update the requested details and submit again."}
              <div className="mt-3">
                <Button asChild variant="outline" size="sm">
                  <Link href={"/resident/support?category=onboarding" as Route}>
                    Get onboarding help
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5" aria-hidden="true" />
              Profile Details
            </CardTitle>
            <CardDescription>
              Use official details that match your uploaded documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {form.formState.errors.root?.message ? (
              <div className="mb-5">
                <APIErrorState
                  title="Onboarding action failed"
                  message={form.formState.errors.root.message}
                />
              </div>
            ) : null}
            <form className="grid gap-5" onSubmit={form.handleSubmit(saveProfile)}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field form={form} name="fullName" label="Full name" />
                <Field form={form} name="preferredName" label="Preferred name" />
                <Field form={form} name="dateOfBirth" label="Date of birth" type="date" />
                <Field form={form} name="gender" label="Gender" />
                <Field form={form} name="phone" label="Phone" type="tel" />
                <Field form={form} name="email" label="Email" type="email" />
                <Field form={form} name="parentName" label="Parent/guardian name" />
                <Field form={form} name="parentPhone" label="Parent/guardian phone" type="tel" />
                <Field form={form} name="parentEmail" label="Parent email" type="email" />
                <Field form={form} name="guardianRelation" label="Guardian relation" />
                <Field form={form} name="emergencyContactName" label="Emergency contact name" />
                <Field form={form} name="emergencyContactPhone" label="Emergency phone" type="tel" />
                <Field form={form} name="aadhaarLast4" label="Aadhaar last 4 digits" inputMode="numeric" />
                <Field form={form} name="collegeName" label="College / employer" />
                <Field form={form} name="courseName" label="Course / department" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="permanentAddress">Permanent address</Label>
                <Textarea id="permanentAddress" {...form.register("permanentAddress")} />
                {form.formState.errors.permanentAddress ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.permanentAddress.message}
                  </p>
                ) : null}
              </div>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                )}
                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IdCard className="size-4" aria-hidden="true" />
                Required Documents
              </CardTitle>
              <CardDescription>Upload clear images or PDFs where allowed.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {uploadRecoveryMessage ? (
                <APIErrorState
                  title="Upload recovery"
                  message={uploadRecoveryMessage}
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link href={"/resident/support?category=upload" as Route}>
                        Open support
                      </Link>
                    </Button>
                  }
                />
              ) : null}
              <DocumentUploader
                label="Aadhaar"
                uploaded={Boolean(resident.aadhaar_document_id)}
                file={aadhaarFile}
                onFile={setAadhaarFile}
                onUpload={() => void uploadFile("aadhaar")}
                disabled={aadhaarUpload.isPending}
              />
              <DocumentUploader
                label="Profile photo"
                uploaded={Boolean(resident.profile_image_document_id)}
                file={photoFile}
                onFile={setPhotoFile}
                onUpload={() => void uploadFile("photo")}
                disabled={photoUpload.isPending}
              />
              <DocumentUploader
                label="Student ID"
                uploaded={Boolean(resident.student_id_document_id)}
                file={studentIdFile}
                onFile={setStudentIdFile}
                onUpload={() => void uploadFile("student_id")}
                disabled={studentIdUpload.isPending}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rules and Regulations</CardTitle>
              <CardDescription>
                Read and accept these hostel rules before continuing.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ol className="grid gap-3 text-sm leading-6 text-muted-foreground">
                {HOSTEL_RULES.map((rule, index) => (
                  <li key={rule} className="grid grid-cols-[1.75rem_1fr] gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{rule}</span>
                  </li>
                ))}
              </ol>
              <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary"
                  checked={rulesAccepted}
                  disabled={onboardingComplete}
                  onChange={(event) => setRulesAcceptedOverride(event.target.checked)}
                />
                <span>
                  I have read and accept the hostel rules and regulations, including the
                  no-refund rule after joining.
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                Rules version {HOSTEL_RULES_VERSION}. Acceptance is saved with your onboarding
                record.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Missing Items</CardTitle>
              <CardDescription>Complete these to activate your dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              {effectiveMissing.length === 0 ? (
                <div className="rounded-lg border bg-emerald-50 p-3 text-sm text-emerald-700">
                  All requirements are complete.
                </div>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {effectiveMissing.map((item) => (
                    <li key={item} className="rounded-lg border p-2">
                      {missingLabels[item] ?? item}
                    </li>
                  ))}
                </ul>
              )}
              <Button
                className="mt-4 w-full gap-2"
                disabled={
                  onboardingComplete ||
                  !canFinishOnboarding ||
                  submitOnboarding.isPending
                }
                onClick={() => void submitForVerification()}
              >
                {submitOnboarding.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                {onboardingComplete ? "Onboarding complete" : "Finish onboarding"}
              </Button>
              {requirements.canAccessResidentOperations ? (
                <Button asChild variant="outline" className="mt-2 w-full">
                  <Link href={"/resident/dashboard" as Route}>Go to dashboard</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Field({
  form,
  name,
  label,
  type = "text",
  inputMode,
}: {
  form: ReturnType<typeof useForm<FormInput, unknown, FormValues>>
  name: keyof FormInput
  label: string
  type?: string
  inputMode?: "numeric"
}) {
  const error = form.formState.errors[name]?.message

  return (
    <div className="grid gap-2">
      <Label htmlFor={String(name)}>{label}</Label>
      <Input
        id={String(name)}
        type={type}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        {...form.register(name)}
      />
      {error ? <p className="text-xs text-destructive">{String(error)}</p> : null}
    </div>
  )
}

function DocumentUploader({
  label,
  uploaded,
  file,
  onFile,
  onUpload,
  disabled,
}: {
  label: string
  uploaded: boolean
  file: File | null
  onFile: (file: File | null) => void
  onUpload: () => void
  disabled: boolean
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {uploaded ? "Uploaded" : file?.name ?? "No file selected"}
          </p>
        </div>
        {uploaded ? <CheckCircle2 className="size-4 text-emerald-600" /> : null}
      </div>
      <Input
        type="file"
        className="mt-3"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full gap-2"
        disabled={!file || disabled}
        onClick={onUpload}
      >
        {disabled ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileUp className="size-4" aria-hidden="true" />
        )}
        Upload {label}
      </Button>
    </div>
  )
}

function hasAcceptedCurrentHostelRules(resident: NonNullable<ReturnType<typeof useResidentOnboarding>["data"]>["resident"]) {
  if (
    resident.onboarding_status === "verified" &&
    resident.status === "active" &&
    resident.is_active !== false
  ) {
    return true
  }

  const metadata = objectFromUnknown(resident.metadata)
  const onboarding = objectFromUnknown(metadata.onboarding)
  const acceptance = objectFromUnknown(onboarding.hostelRulesAcceptance)

  return (
    acceptance.accepted === true &&
    acceptance.version === HOSTEL_RULES_VERSION &&
    typeof acceptance.acceptedAt === "string"
  )
}

function objectFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
