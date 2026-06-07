"use client"

import { useState, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, CheckCircle2, Clock3, Loader2, MessageCircle, RotateCcw, Send, ShieldCheck, Wrench, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { DataTableShell } from "@/components/shared/data-table-shell"
import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState, WorkflowStatus } from "@/components/system"
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
import { callHref, whatsappHref } from "@/constants/hostel"
import { useCurrentResident, useCreateSupportRequest, useSupportRequests } from "@/hooks"
import { createRequestId } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import type { SupportRequestCreateInput } from "@/validations/support.validation"

const categories = [
  "onboarding",
  "payment",
  "invite",
  "upload",
  "room",
  "lost_found",
  "maintenance",
  "safety",
  "account",
  "session",
  "general",
] as const

type Category = (typeof categories)[number]
type Priority = NonNullable<SupportRequestCreateInput["priority"]>
const residentReportCategories = ["lost_found", "maintenance", "safety"] as const

export function ResidentSupportClient() {
  const searchParams = useSearchParams()
  const { organizationId } = useAuth()
  const resident = useCurrentResident(organizationId ?? undefined)
  const initialCategory = parseCategory(searchParams.get("category"))
  const [category, setCategory] = useState<Category>(initialCategory)
  const [priority, setPriority] = useState<Priority>("medium")
  const [subject, setSubject] = useState(defaultSubject(initialCategory))
  const [description, setDescription] = useState("")
  const [lastGuidance, setLastGuidance] = useState<{
    title: string
    summary: string
    steps: string[]
  } | null>(null)
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState<{
    id: string
    subject: string
    status: string
    reused: boolean
  } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const requests = useSupportRequests({
    organizationId: organizationId ?? "",
    residentId: resident.data?.id,
    page: 1,
    pageSize: 20,
  })
  const createRequest = useCreateSupportRequest()
  const [idempotencyKey, setIdempotencyKey] = useState(() => createRequestId())

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization access pending"
        message="Ask hostel administration to finish linking your resident account before raising support."
      />
    )
  }

  if (resident.isLoading) {
    return <LoadingState variant="cards" />
  }

  if (resident.isError) {
    return (
      <APIErrorState
        title="Support profile could not be loaded"
        error={resident.error}
        onRetry={() => void resident.refetch()}
        action={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={callHref}>Call admin</a>
            </Button>
            <Button asChild size="sm">
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </Button>
          </>
        }
      />
    )
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    if (!organizationId) {
      return
    }

    try {
      const result = await createRequest.mutateAsync({
        organizationId,
        category,
        priority,
        subject,
        description,
        workflow: isResidentReportCategory(category) ? "resident_report" : category,
        idempotencyKey,
      })

      setLastGuidance(result.guidance)
      setLastSubmittedRequest({
        id: result.request.id,
        subject: result.request.subject,
        status: result.request.status,
        reused: result.reused,
      })
      setDescription("")
      setSubject(defaultSubject(category))
      setIdempotencyKey(createRequestId())
      await requests.refetch()
      toast.success(result.reused ? "Existing recovery request reopened." : "Support request sent.")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to create support request.")
      toast.error(error instanceof Error ? error.message : "Unable to create support request.")
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Support & Recovery"
        description="Get unstuck from profile, uploads, payments, lost/found items, facility issues, or account access."
        actions={
          <>
            <Button asChild variant="outline">
              <a href={callHref}>Call admin</a>
            </Button>
            <Button asChild>
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
          </>
        }
      />

      <SupportCategoryShortcuts
        onSelect={(nextCategory, nextPriority) => {
          setCategory(nextCategory)
          setPriority(nextPriority)
          setSubject(defaultSubject(nextCategory))
        }}
      />

      {lastSubmittedRequest ? (
        <WorkflowStatus
          tone={lastSubmittedRequest.reused ? "info" : "success"}
          title={lastSubmittedRequest.reused ? "Existing request reopened" : "Support request submitted"}
          description={`${lastSubmittedRequest.subject} is now ${humanizeEnum(lastSubmittedRequest.status)}. Staff can track it from operational alerts and you can follow the timeline below.`}
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCategory("general")
                setPriority("medium")
                setSubject("Support request")
                setDescription("")
              }}
            >
              Start another request
            </Button>
          }
        />
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <form
          onSubmit={submitRequest}
          className="rounded-xl border bg-background p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold">Raise a tracked request</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            This creates a tracked request for hostel staff. Pick a category shortcut, add
            details, and follow status below.
          </p>

          <div className="mt-5 grid gap-4">
            {submitError ? (
              <APIErrorState
                title="Support request failed"
                message={submitError}
                onRetry={() => setSubmitError(null)}
              />
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Issue type</Label>
                <Select
                  value={category}
                  onValueChange={(value) => {
                    const nextCategory = parseCategory(value)
                    setCategory(nextCategory)
                    setSubject(defaultSubject(nextCategory))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item === "onboarding" ? "Profile access" : humanizeEnum(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as Priority)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["low", "medium", "high", "urgent"] as const).map((item) => (
                      <SelectItem key={item} value={item}>
                        {humanizeEnum(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                value={subject}
                minLength={4}
                maxLength={180}
                aria-invalid={subject.trim().length > 0 && subject.trim().length < 4}
                onChange={(event) => setSubject(event.target.value)}
              />
              {subject.trim().length > 0 && subject.trim().length < 4 ? (
                <p className="text-xs text-destructive">
                  Subject must be at least 4 characters.
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="support-description">What happened?</Label>
              <Textarea
                id="support-description"
                value={description}
                minLength={10}
                maxLength={4000}
                className="min-h-32"
                placeholder={descriptionPlaceholder(category)}
                aria-invalid={description.trim().length > 0 && description.trim().length < 10}
                onChange={(event) => setDescription(event.target.value)}
              />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {description.trim().length > 0 && description.trim().length < 10
                    ? "Add a little more detail so staff can act."
                    : "Include room, time, payment reference, or screenshot context when relevant."}
                </span>
                <span>{description.length}/4000</span>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="mt-5 w-full"
            disabled={createRequest.isPending || subject.trim().length < 4 || description.trim().length < 10}
          >
            {createRequest.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            Send request
          </Button>
        </form>

        <div className="grid content-start gap-4">
          <div className="rounded-xl border bg-muted/20 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <RotateCcw className="size-4" aria-hidden="true" />
              Recovery guidance
            </h2>
            {lastGuidance ? (
              <div className="mt-3">
                <p className="text-sm font-medium">{lastGuidance.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lastGuidance.summary}
                </p>
                <ul className="mt-3 grid gap-2 text-sm">
                  {lastGuidance.steps.map((step) => (
                    <li key={step} className="rounded-lg border bg-background p-2">
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Choose an issue type and send a request. The system will show the safest next steps and staff will see it in operational alerts.
              </p>
            )}
          </div>

        </div>
      </section>

      <DataTableShell
        title="My support requests"
        description="Track recovery requests raised from this resident account."
        empty={
          requests.data?.data.length === 0 ? (
            <EmptyState
              title="No support requests yet"
              message="Raise a request when profile, uploads, payment, or account access gets stuck."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCategory("general")
                    setPriority("medium")
                    setSubject(defaultSubject("general"))
                  }}
                >
                  Prepare request
                </Button>
              }
            />
          ) : undefined
        }
      >
        {requests.isError ? (
          <div className="p-4">
            <APIErrorState
              title="Support requests could not be loaded"
              error={requests.error}
              onRetry={() => void requests.refetch()}
            />
          </div>
        ) : requests.isLoading ? (
          <div className="p-4">
            <LoadingState variant="table" />
          </div>
        ) : (
          <div className="divide-y">
            {requests.data?.data.map((request) => (
              <article key={request.id} className="grid gap-2 p-4 md:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{request.subject}</h3>
                    <StatusBadge status={request.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {humanizeEnum(request.category)} · {humanizeEnum(request.priority)} · {formatDateTime(request.created_at)}
                  </p>
                  {request.resolution_notes ? (
                    <p className="mt-2 rounded-lg bg-muted/40 p-2 text-sm">
                      {request.resolution_notes}
                    </p>
                  ) : null}
                  <SupportRequestTimeline status={request.status} />
                </div>
              </article>
            ))}
          </div>
        )}
      </DataTableShell>
    </div>
  )
}

function SupportCategoryShortcuts({
  onSelect,
}: {
  onSelect: (category: Category, priority: Priority) => void
}) {
  const shortcuts: Array<{
    category: Category
    priority: Priority
    title: string
    description: string
    icon: LucideIcon
  }> = [
    {
      category: "maintenance",
      priority: "medium",
      title: "Maintenance",
      description: "Fan, light, water, cleaning, or room facility issue.",
      icon: Wrench,
    },
    {
      category: "safety",
      priority: "urgent",
      title: "Safety",
      description: "Security, night lighting, access, or urgent concern.",
      icon: ShieldCheck,
    },
    {
      category: "payment",
      priority: "high",
      title: "Payment",
      description: "Rejected proof, pending verification, or fee question.",
      icon: AlertTriangle,
    },
    {
      category: "lost_found",
      priority: "medium",
      title: "Lost / found",
      description: "Report a missing or found item with place and time.",
      icon: MessageCircle,
    },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {shortcuts.map((item) => {
        const Icon = item.icon

        return (
          <button
            key={item.category}
            type="button"
            className="rounded-xl border bg-card p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lifted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            onClick={() => onSelect(item.category, item.priority)}
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="mt-3 block text-sm font-semibold">{item.title}</span>
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">
              {item.description}
            </span>
          </button>
        )
      })}
    </section>
  )
}

function SupportRequestTimeline({ status }: { status: string }) {
  const steps = [
    { key: "open", label: "Submitted", icon: Send },
    { key: "in_progress", label: "Staff reviewing", icon: Clock3 },
    { key: "waiting_on_resident", label: "Needs resident info", icon: MessageCircle },
    { key: "resolved", label: "Resolved", icon: CheckCircle2 },
  ]
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === status)
  )
  const resolved = status === "resolved" || status === "closed"
  const explanation = getSupportStatusExplanation(status)

  return (
    <div className="mt-3 grid gap-2 rounded-lg border bg-background/70 p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Request timeline</p>
        <p className="text-xs text-muted-foreground">{explanation.window}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon
          const complete = resolved || index <= activeIndex

          return (
            <div
              key={step.key}
              className={complete ? "rounded-lg bg-primary/10 p-2 text-primary" : "rounded-lg bg-muted/50 p-2 text-muted-foreground"}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <p className="mt-1 text-xs font-medium">{step.label}</p>
            </div>
          )
        })}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{explanation.message}</p>
    </div>
  )
}

function getSupportStatusExplanation(status: string) {
  if (status === "waiting_on_resident") {
    return {
      window: "Waiting on you",
      message: "Staff needs more information before they can close this request.",
    }
  }

  if (status === "in_progress") {
    return {
      window: "Staff reviewing",
      message: "The request is being worked on. Add a new request only if this is a different issue.",
    }
  }

  if (status === "resolved" || status === "closed") {
    return {
      window: "Completed",
      message: "Review the resolution notes. Raise a new request if the same issue returns.",
    }
  }

  return {
    window: "Expected response: next admin review",
    message: "Your request is submitted and visible to hostel staff.",
  }
}

function parseCategory(value: string | null): Category {
  return categories.includes(value as Category) ? (value as Category) : "general"
}

function defaultSubject(category: Category) {
  const labels: Record<Category, string> = {
    onboarding: "Profile access recovery needed",
    payment: "Payment review or retry needed",
    invite: "Invite access needed",
    upload: "Upload retry needed",
    room: "Hostel stay issue",
    lost_found: "Lost or found item report",
    maintenance: "Maintenance issue report",
    safety: "Safety issue report",
    account: "Account access issue",
    session: "Session recovery needed",
    general: "Support request",
  }

  return labels[category]
}

function descriptionPlaceholder(category: Category) {
  const placeholders: Record<Category, string> = {
    onboarding: "Example: I need to correct my father or mother phone number in my resident profile.",
    payment: "Example: I paid by UPI, but my payment is still pending after uploading proof.",
    invite: "Example: My invite link expired before I completed activation.",
    upload: "Example: The screenshot upload failed on mobile even after retrying.",
    room: "Example: I need help with a hostel stay detail shown in the portal.",
    lost_found: "Example: I found a black wallet near the dining area at 8 pm.",
    maintenance: "Example: The fan in room 204 is not working since this morning.",
    safety: "Example: The staircase light near the second floor is not working at night.",
    account: "Example: I can log in, but my resident profile is not linked correctly.",
    session: "Example: My login keeps redirecting back to the login page.",
    general: "Example: I need help with a hostel portal issue.",
  }

  return placeholders[category]
}

function isResidentReportCategory(category: Category) {
  return (residentReportCategories as readonly string[]).includes(category)
}
