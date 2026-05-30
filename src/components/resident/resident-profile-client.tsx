"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  IdCard,
  Loader2,
  Save,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { useForm, type UseFormRegisterReturn } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
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
import { formatDate, humanizeEnum } from "@/lib/format"
import {
  useCurrentResident,
  useDocumentUpload,
  useProfilePhotoUpload,
  useUpdateCurrentResident,
} from "@/hooks"
import type { UploadResult } from "@/sdk"
import { updateOwnResidentProfileSchema } from "@/validations/resident.validation"

const profileFormSchema = updateOwnResidentProfileSchema.omit({
  organizationId: true,
})

type ProfileFormInput = z.input<typeof profileFormSchema>
type ProfileFormValues = z.output<typeof profileFormSchema>

export function ResidentProfileClient() {
  const { organizationId } = useAuth()
  const residentQuery = useCurrentResident(organizationId ?? undefined)
  const updateProfile = useUpdateCurrentResident()
  const [aadhaarUploadProgress, setAadhaarUploadProgress] = useState(0)
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0)
  const [latestAadhaarUpload, setLatestAadhaarUpload] = useState<UploadResult | null>(
    null
  )
  const [latestPhotoUpload, setLatestPhotoUpload] = useState<UploadResult | null>(null)

  const resident = residentQuery.data ?? null
  const documentUpload = useDocumentUpload({
    onProgress: (progress) => setAadhaarUploadProgress(progress.percent),
  })
  const profilePhotoUpload = useProfilePhotoUpload({
    onProgress: (progress) => setPhotoUploadProgress(progress.percent),
  })

  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      preferredName: "",
      phone: "",
      email: "",
      parentName: "",
      parentPhone: "",
      parentEmail: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      permanentAddress: "",
    },
  })

  useEffect(() => {
    if (!resident) {
      return
    }

    form.reset({
      preferredName: resident.preferred_name ?? "",
      phone: resident.phone ?? "",
      email: resident.email ?? "",
      parentName: resident.parent_name ?? "",
      parentPhone: resident.parent_phone ?? "",
      parentEmail: resident.parent_email ?? "",
      emergencyContactName: resident.emergency_contact_name ?? "",
      emergencyContactPhone: resident.emergency_contact_phone ?? "",
      permanentAddress: resident.permanent_address ?? "",
    })
  }, [form, resident])

  const completion = useMemo(() => {
    if (!resident) {
      return 0
    }

    const requiredFields = [
      resident.phone,
      resident.email,
      resident.parent_name,
      resident.parent_phone,
      resident.emergency_contact_name,
      resident.emergency_contact_phone,
      resident.permanent_address,
      resident.aadhaar_document_id,
      resident.profile_image_document_id,
    ]

    const completed = requiredFields.filter(Boolean).length

    return Math.round((completed / requiredFields.length) * 100)
  }, [resident])

  async function onSubmit(values: ProfileFormValues) {
    if (!organizationId) {
      toast.error("Your account is not linked to an organization yet.")
      return
    }

    try {
      await updateProfile.mutateAsync({
        organizationId,
        ...values,
      })
      toast.success("Profile updated.")
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to update profile. Please retry.",
      })
    }
  }

  async function uploadAadhaar(file: File | null) {
    if (!file || !organizationId || !resident) {
      return
    }

    try {
      setAadhaarUploadProgress(0)
      const result = await documentUpload.mutateAsync({
        input: {
          organizationId,
          hostelId: resident.hostel_id,
          residentId: resident.id,
          documentType: "aadhaar",
          isPublic: false,
        },
        file,
      })

      setLatestAadhaarUpload(result)
      void residentQuery.refetch()
      toast.success("Aadhaar document uploaded.")
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Aadhaar upload failed. Please retry."
      )
    }
  }

  async function uploadProfilePhoto(file: File | null) {
    if (!file || !organizationId || !resident) {
      return
    }

    try {
      setPhotoUploadProgress(0)
      const result = await profilePhotoUpload.mutateAsync({
        input: {
          organizationId,
          hostelId: resident.hostel_id,
          residentId: resident.id,
        },
        file,
      })

      setLatestPhotoUpload(result)
      void residentQuery.refetch()
      toast.success("Profile photo uploaded.")
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Profile photo upload failed. Please retry."
      )
    }
  }

  if (residentQuery.isLoading) {
    return <ProfileSkeleton />
  }

  if (residentQuery.isError) {
    return (
      <APIErrorState
        title="Profile could not be loaded"
        error={residentQuery.error}
        onRetry={() => void residentQuery.refetch()}
      />
    )
  }

  if (!resident) {
    return (
      <EmptyState
        title="Resident profile not linked"
        message="Ask the hostel admin to link your login account to your resident record."
      />
    )
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <ProfileMetric
          label="Profile completion"
          value={`${completion}%`}
          detail="Required contact and document fields"
        />
        <ProfileMetric
          label="Admission"
          value={resident.admission_number}
          detail={`Joined ${resident.joined_on ? formatDate(resident.joined_on) : "pending"}`}
        />
        <ProfileMetric
          label="Status"
          value={<StatusBadge status={resident.status} />}
          detail={humanizeEnum(resident.resident_type)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Personal Profile</CardTitle>
            <CardDescription>
              Keep your contact, guardian, and emergency details current.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {form.formState.errors.root?.message ? (
              <div className="mb-5">
                <APIErrorState
                  title="Profile update failed"
                  message={form.formState.errors.root.message}
                />
              </div>
            ) : null}
            <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <ReadOnlyField label="Full name" value={resident.full_name} />
                <ReadOnlyField label="Resident type" value={humanizeEnum(resident.resident_type)} />
                <Field
                  id="preferredName"
                  label="Preferred name"
                  registration={form.register("preferredName")}
                  error={form.formState.errors.preferredName?.message}
                />
                <Field
                  id="phone"
                  label="Phone"
                  type="tel"
                  registration={form.register("phone")}
                  error={form.formState.errors.phone?.message}
                />
                <Field
                  id="email"
                  label="Email"
                  type="email"
                  registration={form.register("email")}
                  error={form.formState.errors.email?.message}
                />
                <ReadOnlyField
                  label="Monthly fee"
                  value={`₹${Number(resident.monthly_fee_amount).toLocaleString("en-IN")}`}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  id="parentName"
                  label="Parent or guardian"
                  registration={form.register("parentName")}
                  error={form.formState.errors.parentName?.message}
                />
                <Field
                  id="parentPhone"
                  label="Parent phone"
                  type="tel"
                  registration={form.register("parentPhone")}
                  error={form.formState.errors.parentPhone?.message}
                />
                <Field
                  id="parentEmail"
                  label="Parent email"
                  type="email"
                  registration={form.register("parentEmail")}
                  error={form.formState.errors.parentEmail?.message}
                />
                <Field
                  id="emergencyContactName"
                  label="Emergency contact"
                  registration={form.register("emergencyContactName")}
                  error={form.formState.errors.emergencyContactName?.message}
                />
                <Field
                  id="emergencyContactPhone"
                  label="Emergency phone"
                  type="tel"
                  registration={form.register("emergencyContactPhone")}
                  error={form.formState.errors.emergencyContactPhone?.message}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="permanentAddress">Permanent address</Label>
                <Textarea
                  id="permanentAddress"
                  rows={4}
                  {...form.register("permanentAddress")}
                />
                {form.formState.errors.permanentAddress?.message ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.permanentAddress.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="submit"
                  disabled={updateProfile.isPending}
                  className="gap-2"
                >
                  {updateProfile.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  Save profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <UploadPanel
            icon={IdCard}
            title="Aadhaar document"
            description="PDF, PNG, JPEG, or WebP up to 5 MB."
            acceptedTypes="application/pdf,image/png,image/jpeg,image/webp"
            isUploaded={Boolean(resident.aadhaar_document_id || latestAadhaarUpload)}
            isPending={documentUpload.isPending}
            progress={aadhaarUploadProgress}
            previewUrl={latestAadhaarUpload?.signedUrl}
            onFileSelected={uploadAadhaar}
          />
          <UploadPanel
            icon={UserRound}
            title="Profile photo"
            description="PNG, JPEG, or WebP up to 4 MB."
            acceptedTypes="image/png,image/jpeg,image/webp"
            isUploaded={Boolean(resident.profile_image_document_id || latestPhotoUpload)}
            isPending={profilePhotoUpload.isPending}
            progress={photoUploadProgress}
            previewUrl={latestPhotoUpload?.signedUrl}
            onFileSelected={uploadProfilePhoto}
          />
        </div>
      </div>
    </div>
  )
}

function ProfileMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string | ReactNode
  detail: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  )
}

function Field({
  id,
  label,
  type = "text",
  registration,
  error,
}: {
  id: keyof ProfileFormInput
  label: string
  type?: string
  registration: UseFormRegisterReturn
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} {...registration} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="min-h-8 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm">
        {value}
      </div>
    </div>
  )
}

function UploadPanel({
  icon: Icon,
  title,
  description,
  acceptedTypes,
  isUploaded,
  isPending,
  progress,
  previewUrl,
  onFileSelected,
}: {
  icon: LucideIcon
  title: string
  description: string
  acceptedTypes: string
  isUploaded: boolean
  isPending: boolean
  progress: number
  previewUrl?: string
  onFileSelected: (file: File | null) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-2 text-sm">
          {isUploaded ? (
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <AlertCircle className="size-4 text-amber-600" aria-hidden="true" />
          )}
          <span>{isUploaded ? "Uploaded" : "Required for full onboarding"}</span>
        </div>
        <Label className="grid cursor-pointer gap-2 rounded-lg border border-dashed p-4 text-center hover:bg-muted/40">
          <FileUp className="mx-auto size-5" aria-hidden="true" />
          <span className="text-sm font-medium">
            {isPending ? `Uploading ${progress}%` : "Choose file"}
          </span>
          <Input
            type="file"
            accept={acceptedTypes}
            className="sr-only"
            disabled={isPending}
            onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
          />
        </Label>
        {previewUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              Preview latest upload
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <Card key={item}>
            <CardHeader>
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-7 w-20 rounded bg-muted" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-4 w-64 rounded bg-muted" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="h-10 rounded bg-muted" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
