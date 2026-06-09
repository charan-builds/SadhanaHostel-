import "server-only"

import { conflict } from "@/lib/api/api-error"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { OperationsRepository } from "@/repositories/operations.repository"
import { WhatsappAutomationRepository } from "@/repositories/whatsapp-automation.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Json } from "@/types/database"
import type {
  WhatsappAutomationDashboard,
  WhatsappAutomationEventKey,
  WhatsappQueueRow,
  WhatsappQueueStatus,
} from "@/types/whatsapp-automation"
import {
  whatsappAutomationQuerySchema,
  whatsappProcessQueueSchema,
  whatsappQueueEventSchema,
  whatsappTemplatePreviewSchema,
  whatsappTemplateSaveSchema,
  whatsappTestSendSchema,
} from "@/validations/whatsapp.validation"

import { AuthService } from "../auth.service"

const defaultTemplates: Array<{
  eventKey: WhatsappAutomationEventKey
  name: string
  body: string
}> = [
  {
    eventKey: "admission_created",
    name: "Admission Created",
    body: "Hello {{residentName}}, your admission at {{hostelName}} has been created. Admission no: {{admissionNumber}}.",
  },
  {
    eventKey: "resident_activated",
    name: "Resident Activated",
    body: "Welcome {{residentName}}. Your resident portal is active for {{hostelName}}.",
  },
  {
    eventKey: "monthly_invoice_generated",
    name: "Monthly Invoice Generated",
    body: "Monthly fee invoice for {{month}} is ready. Amount: {{amount}}. Due date: {{dueDate}}.",
  },
  {
    eventKey: "payment_received",
    name: "Payment Received",
    body: "Payment received from {{residentName}} for {{amount}}. Reference: {{reference}}.",
  },
  {
    eventKey: "payment_verified",
    name: "Payment Verified",
    body: "Your payment of {{amount}} has been verified. Thank you, {{residentName}}.",
  },
  {
    eventKey: "leave_submitted",
    name: "Leave Submitted",
    body: "Leave request submitted for {{residentName}} from {{fromDate}} to {{toDate}}.",
  },
  {
    eventKey: "leave_approved",
    name: "Leave Approved",
    body: "Your leave request from {{fromDate}} to {{toDate}} is approved.",
  },
  {
    eventKey: "leave_rejected",
    name: "Leave Rejected",
    body: "Your leave request from {{fromDate}} to {{toDate}} was rejected. Reason: {{reason}}.",
  },
  {
    eventKey: "notice_published",
    name: "Notice Published",
    body: "{{hostelName}} notice: {{noticeTitle}}. Please check the resident portal.",
  },
  {
    eventKey: "checkout_completed",
    name: "Checkout Completed",
    body: "Checkout completed for {{residentName}}. Settlement status: {{settlementStatus}}.",
  },
]

export class WhatsappAutomationService {
  private readonly authService: AuthService
  private readonly repository: WhatsappAutomationRepository
  private readonly operationsRepository: OperationsRepository

  constructor(
    private readonly db: AppSupabaseClient,
    adminDb: AppSupabaseClient = createSupabaseAdminClient()
  ) {
    this.authService = new AuthService(db)
    this.repository = new WhatsappAutomationRepository(adminDb)
    this.operationsRepository = new OperationsRepository(adminDb)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new WhatsappAutomationService(db)
  }

  async getDashboard(input: unknown): Promise<WhatsappAutomationDashboard> {
    const values = whatsappAutomationQuerySchema.parse(input)
    const context = await this.authService.requirePermission("automation.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    await this.ensureDefaultTemplates(values.organizationId, hostelId, context.authUser.id)

    const [templates, recentQueue, analytics] = await Promise.all([
      this.repository.listTemplates({ organizationId: values.organizationId, hostelId }),
      this.repository.listRecentQueue({
        organizationId: values.organizationId,
        hostelId,
        limit: 50,
      }),
      this.getAnalyticsForAuthorizedScope(values.organizationId, hostelId),
    ])

    return {
      templates,
      recentQueue,
      analytics,
    }
  }

  async saveTemplate(input: unknown) {
    const values = whatsappTemplateSaveSchema.parse(input)
    const context = await this.authService.requirePermission("automation.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )
    const existing = values.templateId
      ? await this.repository.getTemplate(values.organizationId, values.templateId)
      : await this.repository.getLatestTemplate({
          organizationId: values.organizationId,
          hostelId,
          eventKey: values.eventKey,
        })
    const version = existing ? existing.version + 1 : 1
    const template = await this.repository.createTemplate({
      organization_id: values.organizationId,
      hostel_id: hostelId,
      event_key: values.eventKey,
      name: values.name,
      body_template: values.bodyTemplate,
      enabled: values.enabled,
      version,
      variables: extractVariables(values.bodyTemplate),
      metadata: {
        previous_template_id: existing?.id ?? null,
        versioned_from: existing?.version ?? null,
      },
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    if (existing) {
      await this.repository.updateTemplate({
        organizationId: values.organizationId,
        templateId: existing.id,
        values: {
          enabled: false,
          updated_by: context.authUser.id,
          metadata: {
            ...(isRecord(existing.metadata) ? existing.metadata : {}),
            superseded_by_template_id: template.id,
          },
        },
      })
    }

    await this.audit({
      organizationId: values.organizationId,
      hostelId,
      actorUserId: context.authUser.id,
      action: "whatsapp_template.saved",
      recordId: template.id,
      metadata: {
        eventKey: template.event_key,
        version: template.version,
        enabled: template.enabled,
      },
    })

    return template
  }

  async preview(input: unknown) {
    const values = whatsappTemplatePreviewSchema.parse(input)
    const context = await this.authService.requirePermission("automation.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )
    const template = values.templateId
      ? await this.repository.getTemplate(values.organizationId, values.templateId)
      : values.eventKey
        ? await this.repository.getLatestTemplate({
            organizationId: values.organizationId,
            hostelId,
            eventKey: values.eventKey,
          })
        : null
    const bodyTemplate = values.bodyTemplate ?? template?.body_template

    if (!bodyTemplate) {
      throw conflict("Choose a template or provide message text for preview.")
    }

    return {
      renderedMessage: renderTemplate(bodyTemplate, values.payload),
      variables: extractVariables(bodyTemplate),
      templateVersion: template?.version ?? null,
    }
  }

  async queueEvent(input: unknown) {
    const values = whatsappQueueEventSchema.parse(input)
    const context = await this.authService.requirePermission("automation.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    return this.queueEventWithActor({
      ...values,
      hostelId,
      actorUserId: context.authUser.id,
    })
  }

  async queueEventSystem(input: {
    organizationId: string
    hostelId?: string | null
    eventKey: WhatsappAutomationEventKey
    residentId?: string | null
    recipientUserId?: string | null
    phone?: string | null
    payload?: Record<string, unknown>
    idempotencyKey?: string | null
    actorUserId?: string | null
  }) {
    return this.queueEventWithActor({
      organizationId: input.organizationId,
      hostelId: input.hostelId ?? undefined,
      eventKey: input.eventKey,
      residentId: input.residentId ?? undefined,
      recipientUserId: input.recipientUserId ?? undefined,
      phone: input.phone ?? undefined,
      payload: input.payload ?? {},
      idempotencyKey: input.idempotencyKey ?? undefined,
      actorUserId: input.actorUserId ?? null,
    })
  }

  async processQueue(input: unknown) {
    const values = whatsappProcessQueueSchema.parse(input)
    const context = await this.authService.requirePermission("automation.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )
    const due = await this.repository.listDueQueue({
      organizationId: values.organizationId,
      hostelId,
      limit: values.limit,
    })
    let sent = 0
    let failed = 0

    for (const row of due) {
      const result = await this.sendQueuedMessage(row, context.authUser.id)

      if (result.status === "failed") {
        failed += 1
      } else {
        sent += 1
      }
    }

    return {
      processed: due.length,
      sent,
      failed,
    }
  }

  async getAnalytics(input: unknown) {
    const values = whatsappAutomationQuerySchema.parse(input)
    const context = await this.authService.requirePermission("automation.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    return this.getAnalyticsForAuthorizedScope(values.organizationId, hostelId)
  }

  async testSend(input: unknown) {
    const values = whatsappTestSendSchema.parse(input)
    const context = await this.authService.requirePermission("automation.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )
    const queued = await this.queueEventWithActor({
      organizationId: values.organizationId,
      hostelId,
      eventKey: values.eventKey,
      phone: values.phone,
      payload: {
        ...values.payload,
        residentName: String(values.payload.residentName ?? "Test Resident"),
      },
      idempotencyKey: `whatsapp-test-${crypto.randomUUID()}`,
      actorUserId: context.authUser.id,
    })

    return this.sendQueuedMessage(queued, context.authUser.id)
  }

  private async queueEventWithActor(input: {
    organizationId: string
    hostelId?: string | null
    eventKey: WhatsappAutomationEventKey
    residentId?: string | null
    recipientUserId?: string | null
    phone?: string | null
    payload: Record<string, unknown>
    idempotencyKey?: string | null
    scheduledFor?: string | null
    actorUserId?: string | null
  }) {
    await this.ensureDefaultTemplates(input.organizationId, input.hostelId, input.actorUserId)

    const template = await this.repository.getLatestTemplate({
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      eventKey: input.eventKey,
      enabledOnly: true,
    })

    if (!template) {
      throw conflict("WhatsApp template is disabled or missing for this event.")
    }

    const resident = input.residentId
      ? await this.loadResident(input.organizationId, input.residentId)
      : null
    const phone = input.phone ?? resident?.phone

    if (!phone) {
      throw conflict("WhatsApp recipient phone is required.")
    }

    const payload = toJsonRecord({
      ...input.payload,
      hostelName: input.payload.hostelName ?? "Sadhana Boys Hostel",
      residentName: resident?.full_name ?? input.payload.residentName ?? "Resident",
      admissionNumber: resident?.admission_number ?? input.payload.admissionNumber ?? "",
    })

    return this.repository.createQueue({
      organization_id: input.organizationId,
      hostel_id: input.hostelId ?? null,
      template_id: template.id,
      resident_id: input.residentId ?? null,
      recipient_user_id: input.recipientUserId ?? resident?.user_id ?? null,
      event_key: input.eventKey,
      recipient_phone: phone,
      rendered_message: renderTemplate(template.body_template, payload),
      payload,
      scheduled_for: input.scheduledFor ?? new Date().toISOString(),
      idempotency_key: input.idempotencyKey ?? null,
      metadata: {
        template_version: template.version,
      },
      created_by: input.actorUserId ?? null,
      updated_by: input.actorUserId ?? null,
    })
  }

  private async sendQueuedMessage(row: WhatsappQueueRow, actorUserId?: string | null) {
    const sending = await this.repository.updateQueue({
      organizationId: row.organization_id,
      queueId: row.id,
      values: {
        status: "sending",
        attempt_count: row.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
        updated_by: actorUserId ?? null,
      },
    })
    const providerResult = await sendWithProvider(sending)
    const nextStatus: WhatsappQueueStatus = providerResult.ok ? "sent" : "failed"
    const attempts = sending.attempt_count
    const finalFailure = !providerResult.ok && attempts >= sending.max_attempts
    const nextAttemptAt = providerResult.ok || finalFailure
      ? null
      : new Date(Date.now() + Math.min(60, 2 ** attempts * 5) * 60_000).toISOString()
    const updated = await this.repository.updateQueue({
      organizationId: row.organization_id,
      queueId: row.id,
      values: {
        status: nextStatus,
        provider: providerResult.provider,
        provider_message_id: providerResult.providerMessageId,
        failure_reason: providerResult.errorMessage,
        next_attempt_at: nextAttemptAt,
        updated_by: actorUserId ?? null,
      },
    })

    await this.repository.createDeliveryEvent({
      organization_id: row.organization_id,
      hostel_id: row.hostel_id,
      queue_id: row.id,
      status: updated.status,
      provider_message_id: updated.provider_message_id,
      error_message: updated.failure_reason,
      payload: providerResult.payload,
      created_by: actorUserId ?? null,
    })

    if (providerResult.ok) {
      await this.repository.updateQueue({
        organizationId: row.organization_id,
        queueId: row.id,
        values: {
          status: "delivered",
          updated_by: actorUserId ?? null,
        },
      })
      await this.repository.createDeliveryEvent({
        organization_id: row.organization_id,
        hostel_id: row.hostel_id,
        queue_id: row.id,
        status: "delivered",
        provider_message_id: updated.provider_message_id,
        payload: {
          simulated_delivery: true,
        },
        created_by: actorUserId ?? null,
      })
    }

    return updated
  }

  private async getAnalyticsForAuthorizedScope(
    organizationId: string,
    hostelId?: string | null
  ) {
    const [sent, delivered, failed, retried, queued, templates] = await Promise.all([
      this.repository.countQueue({ organizationId, hostelId, status: "sent" }),
      this.repository.countQueue({ organizationId, hostelId, status: "delivered" }),
      this.repository.countQueue({ organizationId, hostelId, status: "failed" }),
      this.repository.countQueue({ organizationId, hostelId, retried: true }),
      this.repository.countQueue({ organizationId, hostelId, status: "queued" }),
      this.repository.listTemplates({ organizationId, hostelId }),
    ])

    return {
      sent,
      delivered,
      failed,
      retried,
      queued,
      templatesEnabled: templates.filter((template) => template.enabled).length,
      templatesDisabled: templates.filter((template) => !template.enabled).length,
    }
  }

  private async ensureDefaultTemplates(
    organizationId: string,
    hostelId?: string | null,
    actorUserId?: string | null
  ) {
    const existing = await this.repository.listTemplates({ organizationId, hostelId })
    const existingKeys = new Set(existing.map((template) => template.event_key))

    for (const template of defaultTemplates) {
      if (existingKeys.has(template.eventKey)) {
        continue
      }

      await this.repository.createTemplate({
        organization_id: organizationId,
        hostel_id: hostelId ?? null,
        event_key: template.eventKey,
        name: template.name,
        body_template: template.body,
        enabled: true,
        version: 1,
        variables: extractVariables(template.body),
        metadata: {
          seeded_default: true,
        },
        created_by: actorUserId ?? null,
        updated_by: actorUserId ?? null,
      })
    }
  }

  private async loadResident(organizationId: string, residentId: string) {
    const rows = await this.operationsRepository.list("residents", {
      organizationId,
      select: "id,full_name,admission_number,phone,user_id",
      equals: { id: residentId },
      deletedAtNull: true,
      limit: 1,
    })

    return rows[0] as
      | {
          id: string
          full_name: string
          admission_number: string | null
          phone: string | null
          user_id: string | null
        }
      | undefined
  }

  private async audit(input: {
    organizationId: string
    hostelId?: string | null
    actorUserId: string
    action: string
    recordId: string
    metadata: Record<string, unknown>
  }) {
    await this.operationsRepository.createAuditLog({
      organization_id: input.organizationId,
      hostel_id: input.hostelId ?? null,
      actor_user_id: input.actorUserId,
      table_name: "whatsapp_message_templates",
      record_id: input.recordId,
      action: input.action,
      metadata: toJsonRecord(input.metadata),
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
  }
}

export function renderTemplate(template: string, payload: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = payload[key]

    if (value === undefined || value === null) {
      return ""
    }

    return String(value)
  })
}

export function extractVariables(template: string) {
  return Array.from(
    new Set(
      Array.from(template.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)).map(
        (match) => match[1]
      )
    )
  )
}

async function sendWithProvider(row: WhatsappQueueRow) {
  if (!row.recipient_phone || row.recipient_phone.length < 8) {
    return {
      ok: false,
      provider: "whatsapp-simulated-provider",
      errorMessage: "Recipient phone is invalid.",
      payload: {
        recipientPhonePresent: Boolean(row.recipient_phone),
      },
    }
  }

  return {
    ok: true,
    provider: "whatsapp-simulated-provider",
    providerMessageId: `wa_${crypto.randomUUID()}`,
    errorMessage: null,
    payload: {
      simulated: true,
      messageLength: row.rendered_message.length,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function toJsonRecord(value: Record<string, unknown>): { [key: string]: Json | undefined } {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)])
  )
}

function toJsonValue(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonValue(entry))
  }

  if (isRecord(value)) {
    return toJsonRecord(value)
  }

  return value === undefined ? null : String(value)
}
