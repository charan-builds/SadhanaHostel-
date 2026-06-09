"use client"

import { useMemo, useState } from "react"
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  usePreviewWhatsappTemplate,
  useProcessWhatsappQueue,
  useSaveWhatsappTemplate,
  useTestWhatsappSend,
  useWhatsappAutomationDashboard,
} from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import type {
  WhatsappAutomationEventKey,
  WhatsappTemplateRow,
} from "@/types/whatsapp-automation"

const eventLabels: Record<WhatsappAutomationEventKey, string> = {
  admission_created: "Admission Created",
  resident_activated: "Resident Activated",
  monthly_invoice_generated: "Monthly Invoice Generated",
  payment_received: "Payment Received",
  payment_verified: "Payment Verified",
  leave_submitted: "Leave Submitted",
  leave_approved: "Leave Approved",
  leave_rejected: "Leave Rejected",
  notice_published: "Notice Published",
  checkout_completed: "Checkout Completed",
}

export function AdminWhatsappAutomationClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const dashboard = useWhatsappAutomationDashboard(
    organizationId
      ? {
          organizationId,
          hostelId,
        }
      : undefined
  )
  const saveTemplate = useSaveWhatsappTemplate()
  const previewTemplate = usePreviewWhatsappTemplate()
  const testSend = useTestWhatsappSend()
  const processQueue = useProcessWhatsappQueue()
  const latestTemplates = useMemo(() => {
    const templates = dashboard.data?.templates ?? []
    const byEvent = new Map<WhatsappAutomationEventKey, WhatsappTemplateRow>()

    for (const template of templates) {
      const existing = byEvent.get(template.event_key)

      if (!existing || template.version > existing.version) {
        byEvent.set(template.event_key, template)
      }
    }

    return Array.from(byEvent.values())
  }, [dashboard.data?.templates])
  const [selectedEvent, setSelectedEvent] =
    useState<WhatsappAutomationEventKey>("admission_created")
  const selectedTemplate = latestTemplates.find((template) => template.event_key === selectedEvent)
  const [bodyTemplate, setBodyTemplate] = useState("")
  const [testPhone, setTestPhone] = useState("")
  const [preview, setPreview] = useState("")
  const activeBody = bodyTemplate || selectedTemplate?.body_template || ""
  const analytics = dashboard.data?.analytics

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="WhatsApp automation controls will load when organization access is ready."
      />
    )
  }

  if (dashboard.isLoading) {
    return <LoadingState variant="dashboard" />
  }

  if (dashboard.isError) {
    return (
      <APIErrorState
        title="WhatsApp automation failed to load"
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
      />
    )
  }

  async function save(enabled = selectedTemplate?.enabled ?? true) {
    if (!organizationId || !selectedTemplate) {
      return
    }

    try {
      await saveTemplate.mutateAsync({
        organizationId,
        hostelId,
        templateId: selectedTemplate.id,
        eventKey: selectedEvent,
        name: eventLabels[selectedEvent],
        bodyTemplate: activeBody,
        enabled,
      })
      setBodyTemplate("")
      await dashboard.refetch()
      toast.success("WhatsApp template version saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save template.")
    }
  }

  async function renderPreview() {
    if (!organizationId) {
      return
    }

    try {
      const result = await previewTemplate.mutateAsync({
        organizationId,
        hostelId,
        eventKey: selectedEvent,
        bodyTemplate: activeBody,
        payload: samplePayload(),
      })
      setPreview(result.renderedMessage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to preview template.")
    }
  }

  async function sendTest() {
    if (!organizationId || !testPhone) {
      toast.error("Enter a phone number for test send.")
      return
    }

    try {
      await testSend.mutateAsync({
        organizationId,
        hostelId,
        eventKey: selectedEvent,
        phone: testPhone,
        payload: samplePayload(),
      })
      await dashboard.refetch()
      toast.success("WhatsApp test send completed.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send test WhatsApp.")
    }
  }

  async function processDueQueue() {
    if (!organizationId) {
      return
    }

    try {
      const result = await processQueue.mutateAsync({
        organizationId,
        hostelId,
        limit: 50,
      })
      await dashboard.refetch()
      toast.success(`Processed ${result.processed}; sent ${result.sent}, failed ${result.failed}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to process queue.")
    }
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="WhatsApp Automation"
        description="Template controls, message queue, retries, delivery tracking, and automation analytics."
        badge="Operations Automation"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={dashboard.isFetching}
              onClick={() => void dashboard.refetch()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button
              type="button"
              disabled={processQueue.isPending}
              onClick={() => void processDueQueue()}
            >
              {processQueue.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              Process Queue
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Queued" value={analytics?.queued ?? 0} />
        <Metric label="Sent" value={analytics?.sent ?? 0} />
        <Metric label="Delivered" value={analytics?.delivered ?? 0} />
        <Metric label="Failed" value={analytics?.failed ?? 0} />
        <Metric label="Retried" value={analytics?.retried ?? 0} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Template Controls</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Event</Label>
              <Select
                value={selectedEvent}
                onValueChange={(value) => {
                  setSelectedEvent(value as WhatsappAutomationEventKey)
                  setBodyTemplate("")
                  setPreview("")
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(eventLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selectedTemplate?.enabled ? "secondary" : "outline"}>
                {selectedTemplate?.enabled ? "Enabled" : "Disabled"}
              </Badge>
              <Badge variant="outline">v{selectedTemplate?.version ?? 1}</Badge>
            </div>
            <div className="grid gap-2">
              <Label>Message Template</Label>
              <Textarea
                value={activeBody}
                rows={7}
                onChange={(event) => setBodyTemplate(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={saveTemplate.isPending}
                onClick={() => void save(true)}
              >
                <Save className="size-4" aria-hidden="true" />
                Save Enabled
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saveTemplate.isPending}
                onClick={() => void save(false)}
              >
                <XCircle className="size-4" aria-hidden="true" />
                Disable Template
              </Button>
              <Button type="button" variant="outline" onClick={() => void renderPreview()}>
                <MessageCircle className="size-4" aria-hidden="true" />
                Preview
              </Button>
            </div>
            {preview ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-6">
                {preview}
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Test Phone</Label>
              <div className="flex gap-2">
                <Input
                  value={testPhone}
                  onChange={(event) => setTestPhone(event.target.value)}
                  placeholder="+91..."
                />
                <Button type="button" onClick={() => void sendTest()}>
                  <Send className="size-4" aria-hidden="true" />
                  Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dashboard.data?.recentQueue ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{eventLabels[row.event_key]}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === "failed" ? "destructive" : "secondary"}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.attempt_count}</TableCell>
                      <TableCell>{formatDateTime(row.updated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3">
        {latestTemplates.map((template) => (
          <div
            key={template.id}
            className="flex flex-col gap-2 rounded-lg border bg-background p-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">{template.name}</h2>
                <Badge variant="outline">v{template.version}</Badge>
                {template.enabled ? (
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="outline">Disabled</Badge>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {template.body_template}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedEvent(template.event_key)
                setBodyTemplate(template.body_template)
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Edit
            </Button>
          </div>
        ))}
      </section>
    </ResponsiveContainer>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </article>
  )
}

function samplePayload() {
  return {
    residentName: "Rahul",
    hostelName: "Sadhana Boys Hostel",
    admissionNumber: "SBH-001",
    month: "June 2026",
    amount: "INR 5,000",
    dueDate: "2026-06-10",
    reference: "TEST123456",
    fromDate: "2026-06-12",
    toDate: "2026-06-14",
    reason: "Schedule conflict",
    noticeTitle: "Dinner timing update",
    settlementStatus: "Refund pending",
  }
}
