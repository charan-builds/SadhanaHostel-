"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ClipboardList, Edit, Loader2, Plus } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
import { WorkflowStatus } from "@/components/system/workflow-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useAuth } from "@/lib/auth"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { useCreateNotice, useNotices, useUpdateNotice } from "@/hooks"
import type { Tables } from "@/types/database"

const PAGE_SIZE = 10
const cmsStatuses = ["draft", "published", "archived"] as const
const audienceTypes = ["all", "hostel", "room", "residents", "roles"] as const
type AudienceType = (typeof audienceTypes)[number]
type NoticeOutcome = {
  tone: "success" | "warning" | "info"
  title: string
  description: string
}
const audienceOptions = [
  {
    value: "all",
    label: "All residents",
    description: "Use for general hostel-wide announcements.",
    disabled: false,
  },
  {
    value: "hostel",
    label: "This hostel",
    description: "Best default for Sadhana Boys Hostel notices.",
    disabled: false,
  },
  {
    value: "room",
    label: "Room group",
    description: "Backend-supported, but this editor still needs a room selector.",
    disabled: true,
  },
  {
    value: "residents",
    label: "Selected residents",
    description: "Backend-supported, but this editor still needs resident selection.",
    disabled: true,
  },
  {
    value: "roles",
    label: "Role group",
    description: "Backend-supported, but this editor still needs role selection.",
    disabled: true,
  },
] satisfies Array<{
  value: AudienceType
  label: string
  description: string
  disabled: boolean
}>

const noticeFormSchema = z.object({
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(5).max(5000),
  status: z.enum(cmsStatuses),
  audienceType: z.enum(audienceTypes),
  isPinned: z.boolean(),
  expiresAt: z.string().optional(),
})

type NoticeFormValues = z.infer<typeof noticeFormSchema>

export function AdminNoticesClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<(typeof cmsStatuses)[number] | "all">("all")
  const [editingNotice, setEditingNotice] = useState<Tables<"notices"> | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [noticeOutcome, setNoticeOutcome] = useState<NoticeOutcome | null>(null)

  const noticesQuery = useNotices({
    organizationId: organizationId ?? "",
    hostelId,
    page,
    pageSize: PAGE_SIZE,
    status: status === "all" ? undefined : status,
  })
  const notices = noticesQuery.data?.data ?? []
  const meta = noticesQuery.data?.meta

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <NoticeMetric label="Notices on page" value={notices.length} />
        <NoticeMetric
          label="Published"
          value={notices.filter((notice) => notice.status === "published").length}
        />
        <NoticeMetric
          label="Pinned"
          value={notices.filter((notice) => notice.is_pinned).length}
        />
      </div>

      {noticeOutcome ? (
        <WorkflowStatus
          tone={noticeOutcome.tone}
          title={noticeOutcome.title}
          description={noticeOutcome.description}
        />
      ) : null}

      <Card>
        <CardHeader className="gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Notices</CardTitle>
            <CardDescription>
              Publish resident-facing announcements with audience and expiry controls.
            </CardDescription>
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setEditingNotice(null)
              setIsDialogOpen(true)
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            New notice
          </Button>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as typeof status)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full md:w-48" aria-label="Filter notice status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {cmsStatuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {humanizeEnum(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {noticesQuery.isLoading ? (
            <NoticeSkeleton />
          ) : noticesQuery.isError ? (
            <APIErrorState
              title="Notices could not be loaded"
              error={noticesQuery.error}
              onRetry={() => void noticesQuery.refetch()}
            />
          ) : notices.length === 0 ? (
            <EmptyState
              title="No notices found"
              message="Create a notice to publish hostel updates to residents."
              action={
                <Button
                  type="button"
                  onClick={() => {
                    setEditingNotice(null)
                    setIsDialogOpen(true)
                  }}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  New notice
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {notices.map((notice) => (
                <article key={notice.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={notice.status} />
                        {notice.is_pinned ? (
                          <Badge variant="secondary">Pinned</Badge>
                        ) : null}
                        <Badge variant="outline">{formatAudienceLabel(notice.audience_type)}</Badge>
                      </div>
                      <h2 className="mt-3 font-semibold">{notice.title}</h2>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {notice.body}
                      </p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {notice.published_at
                          ? `Published ${formatDateTime(notice.published_at)}`
                          : "Not published"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setEditingNotice(notice)
                        setIsDialogOpen(true)
                      }}
                    >
                      <Edit className="size-4" aria-hidden="true" />
                      Edit
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {notices.length} of {meta?.total ?? 0} notices
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!meta || page <= 1 || noticesQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!meta || page >= meta.totalPages || noticesQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <NoticeEditorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        notice={editingNotice}
        organizationId={organizationId}
        hostelId={hostelId}
        onSaved={setNoticeOutcome}
      />
    </div>
  )
}

function NoticeEditorDialog({
  open,
  onOpenChange,
  notice,
  organizationId,
  hostelId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  notice: Tables<"notices"> | null
  organizationId: string
  hostelId?: string
  onSaved: (outcome: NoticeOutcome) => void
}) {
  const createNotice = useCreateNotice()
  const updateNotice = useUpdateNotice()
  const form = useForm<NoticeFormValues>({
    resolver: zodResolver(noticeFormSchema),
    defaultValues: getNoticeDefaults(notice),
  })

  useEffect(() => {
    form.reset(getNoticeDefaults(notice))
  }, [form, notice])

  async function onSubmit(values: NoticeFormValues) {
    const audienceOption =
      audienceOptions.find((item) => item.value === values.audienceType) ?? audienceOptions[0]

    if (audienceOption.disabled) {
      form.setError("audienceType", {
        message: "This audience type needs a selector before it can be published from this editor.",
      })
      return
    }

    try {
      const savedNotice = notice ? await updateNotice.mutateAsync({
        noticeId: notice.id,
        organizationId,
        hostelId,
        title: values.title,
        body: values.body,
        status: values.status,
        audienceType: values.audienceType,
        audienceFilter: {},
        isPinned: values.isPinned,
        isActive: true,
        expiresAt: values.expiresAt || undefined,
      }) : await createNotice.mutateAsync({
        organizationId,
        hostelId,
        title: values.title,
        body: values.body,
        status: values.status,
        audienceType: values.audienceType,
        audienceFilter: {},
        isPinned: values.isPinned,
        expiresAt: values.expiresAt || undefined,
      })

      const published = savedNotice.status === "published"
      onSaved({
        tone: published ? "success" : "info",
        title: published ? "Notice published" : "Notice saved",
        description: `${savedNotice.title} was saved as ${humanizeEnum(savedNotice.status)} for ${formatAudienceLabel(savedNotice.audience_type)}${savedNotice.expires_at ? ` until ${formatDateTime(savedNotice.expires_at)}` : ""}.`,
      })
      toast.success(notice ? "Notice updated." : "Notice created.")
      onOpenChange(false)
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Notice could not be saved.",
      })
      toast.error(error instanceof Error ? error.message : "Notice could not be saved.")
    }
  }

  const isPending = createNotice.isPending || updateNotice.isPending
  const selectedAudience = useWatch({
    control: form.control,
    name: "audienceType",
  })
  const selectedAudienceOption =
    audienceOptions.find((item) => item.value === selectedAudience) ?? audienceOptions[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{notice ? "Edit Notice" : "Create Notice"}</DialogTitle>
            <DialogDescription>
              Published notices appear in the resident portal and realtime notice feed.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4">
            {form.formState.errors.root?.message ? (
              <APIErrorState
                title="Notice save failed"
                message={form.formState.errors.root.message}
              />
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="notice-title">Title</Label>
              <Input
                id="notice-title"
                aria-invalid={Boolean(form.formState.errors.title)}
                {...form.register("title")}
              />
              {form.formState.errors.title?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.title.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notice-body">Body</Label>
              <Textarea
                id="notice-body"
                rows={6}
                aria-invalid={Boolean(form.formState.errors.body)}
                {...form.register("body")}
              />
              {form.formState.errors.body?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.body.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cmsStatuses.map((item) => (
                          <SelectItem key={item} value={item}>
                            {humanizeEnum(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="grid gap-2">
                <Label>Audience</Label>
                <Controller
                  control={form.control}
                  name="audienceType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {audienceOptions.map((item) => (
                          <SelectItem
                            key={item.value}
                            value={item.value}
                            disabled={item.disabled && field.value !== item.value}
                          >
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <AudiencePreview option={selectedAudienceOption} />
                {form.formState.errors.audienceType?.message ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.audienceType.message}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label>Expires at</Label>
                <Input type="datetime-local" {...form.register("expiresAt")} />
              </div>
              <div className="grid gap-2">
                <Label>Pinned</Label>
                <Controller
                  control={form.control}
                  name="isPinned"
                  render={({ field }) => (
                    <Select
                      value={field.value ? "yes" : "no"}
                      onValueChange={(value) => field.onChange(value === "yes")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ClipboardList className="size-4" aria-hidden="true" />
              )}
              Save notice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AudiencePreview({
  option,
}: {
  option: (typeof audienceOptions)[number]
}) {
  return (
    <div className="rounded-lg border bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={option.disabled ? "destructive" : "secondary"}>
          {option.disabled ? "Needs selector" : "Publishable"}
        </Badge>
        <span className="font-medium text-foreground">{option.label}</span>
      </div>
      <p className="mt-2">{option.description}</p>
      {option.disabled ? (
        <p className="mt-2">
          Use This hostel for production notices until the specific selector is available.
        </p>
      ) : null}
    </div>
  )
}

function formatAudienceLabel(value: string) {
  return audienceOptions.find((item) => item.value === value)?.label ?? humanizeEnum(value)
}

function getNoticeDefaults(notice: Tables<"notices"> | null): NoticeFormValues {
  return {
    title: notice?.title ?? "",
    body: notice?.body ?? "",
    status: notice?.status ?? "draft",
    audienceType: (notice?.audience_type as NoticeFormValues["audienceType"]) ?? "all",
    isPinned: notice?.is_pinned ?? false,
    expiresAt: notice?.expires_at ? notice.expires_at.slice(0, 16) : "",
  }
}

function NoticeMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <ClipboardList className="size-5" aria-hidden="true" />
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function NoticeSkeleton() {
  return (
    <div className="grid gap-4">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-28 rounded-lg border bg-muted/50" />
      ))}
    </div>
  )
}
