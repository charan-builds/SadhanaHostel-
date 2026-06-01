import "server-only"

import { ADMIN_PORTAL_ROLES } from "@/constants/auth"
import { areCronJobsEnabled, areOperationalRepairsEnabled } from "@/config/launch"
import { badRequest, forbidden } from "@/lib/api/api-error"
import { logError } from "@/lib/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestId } from "@/lib/tracing"
import { AdmissionsService } from "@/services/admissions.service"
import { NotificationService } from "@/services/notifications"
import { AdmissionsRepository } from "@/repositories/admissions.repository"
import { OperationsRepository } from "@/repositories/operations.repository"
import { PaymentSettingsRepository } from "@/repositories/payment-settings.repository"
import { PaymentsRepository } from "@/repositories/payments.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import {
  SupportRepository,
  type SupportRequestRow,
} from "@/repositories/support.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Json } from "@/types/database"
import type {
  OperationalAlert,
  RecoveryGuidance,
  ResidentPasswordResetRequestResult,
  SupportPasswordResetApprovalResult,
  SupportRequestResult,
} from "@/types/support"
import {
  operationalAlertsQuerySchema,
  residentPasswordResetRequestSchema,
  supportPasswordResetApprovalSchema,
  supportRequestCreateSchema,
  supportRequestListSchema,
  supportRequestUpdateSchema,
  type SupportCategory,
} from "@/validations/support.validation"

import { assertFound, AuthService, type AuthContext } from "./auth.service"
import { ResidentsService } from "./residents.service"
import { scanConsistency } from "./operations/consistency.service"

export class SupportService {
  private readonly authService: AuthService
  private readonly supportRepository: SupportRepository
  private readonly residentsRepository: ResidentsRepository
  private readonly paymentsRepository: PaymentsRepository
  private readonly paymentSettingsRepository: PaymentSettingsRepository
  private readonly operationsRepository: OperationsRepository
  private readonly notificationService: NotificationService

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.supportRepository = new SupportRepository(db)
    this.residentsRepository = new ResidentsRepository(db)
    this.paymentsRepository = new PaymentsRepository(db)
    this.paymentSettingsRepository = new PaymentSettingsRepository(db)
    this.operationsRepository = new OperationsRepository(db)
    this.notificationService = new NotificationService(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new SupportService(db)
  }

  static createPublic() {
    return new SupportService(createSupabaseAdminClient())
  }

  async listRequests(input: unknown) {
    const values = supportRequestListSchema.parse(input)
    const context = await this.authService.getCurrentContext()
    const scope = await this.resolveSupportScope(context, {
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      residentId: values.residentId,
    })

    return this.supportRepository.list({
      organizationId: scope.organizationId,
      hostelId: scope.hostelId,
      residentId: scope.forceResidentId ?? values.residentId,
      status: values.status,
      category: values.category,
      priority: values.priority,
      workflow: values.workflow,
      search: values.search,
      page: values.page,
      pageSize: values.pageSize,
    })
  }

  async createRequest(input: unknown): Promise<SupportRequestResult> {
    const values = supportRequestCreateSchema.parse(input)
    const context = await this.authService.getCurrentContext()
    const scope = await this.resolveSupportScope(context, {
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      residentId: values.residentId,
    })

    if (values.idempotencyKey) {
      const existing = await this.supportRepository.findOpenByIdempotencyKey({
        organizationId: scope.organizationId,
        residentId: scope.forceResidentId ?? values.residentId,
        idempotencyKey: values.idempotencyKey,
      })

      if (existing) {
        return {
          request: existing,
          reused: true,
          guidance: buildRecoveryGuidance(values.category),
        }
      }
    }

    const request = await this.supportRepository.create({
      organization_id: scope.organizationId,
      hostel_id: scope.hostelId,
      resident_id: scope.forceResidentId ?? values.residentId ?? null,
      created_by_user_id: context.authUser.id,
      category: values.category,
      priority: values.priority,
      subject: values.subject,
      description: values.description,
      status: "open",
      metadata: {
        workflow: values.workflow ?? null,
        relatedRecordId: values.relatedRecordId ?? null,
        idempotencyKey: values.idempotencyKey ?? null,
        recoveryGuidance: values.category,
      } satisfies Json,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    await this.audit("support.request.created", context, request, null, request)
    await this.notifyOperators(request, context.authUser.id)

    return {
      request,
      reused: false,
      guidance: buildRecoveryGuidance(values.category),
    }
  }

  async createResidentPasswordResetRequest(
    input: unknown
  ): Promise<ResidentPasswordResetRequestResult> {
    const values = residentPasswordResetRequestSchema.parse(input)
    const tenant = await this.resolvePublicSupportTenant(values.organizationId, values.hostelId)
    const resident = await this.residentsRepository.findPasswordResetCandidate({
      organizationId: tenant.organizationId,
      hostelId: tenant.hostelId,
      phone: values.phone,
      admissionNumber: values.admissionNumber || null,
      email: values.email || null,
    })

    if (!resident) {
      return { accepted: true }
    }

    const hasPortalAccount = Boolean(resident.user_id)
    const idempotencyKey = `resident-password-reset:${resident.id}`
    const existing = await this.supportRepository.findOpenByIdempotencyKey({
      organizationId: resident.organization_id,
      residentId: resident.id,
      idempotencyKey,
    })

    if (existing) {
      return { accepted: true }
    }

    const request = await this.supportRepository.create({
      organization_id: resident.organization_id,
      hostel_id: resident.hostel_id,
      resident_id: resident.id,
      created_by_user_id: null,
      category: "account",
      priority: "high",
      subject: "Resident password reset request",
      description: [
        `${resident.full_name} requested a resident portal password reset from the login page.`,
        hasPortalAccount
          ? "Verify the resident identity before issuing a temporary password."
          : "Resident record matched, but no active portal account is linked yet. Create or resend the resident invite before issuing portal access.",
        values.message ? `Resident note: ${values.message}` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
      status: "open",
      metadata: {
        workflow: "resident_password_reset",
        idempotencyKey,
        requestedFrom: "resident_login",
        portalAccountActive: hasPortalAccount,
        submittedPhoneLast4: maskLast4(values.phone),
        submittedAdmissionNumber: values.admissionNumber || null,
        submittedEmail: values.email || null,
      } satisfies Json,
      created_by: null,
      updated_by: null,
    })

    await this.auditWithActor("support.password_reset.requested", null, request, null, request)
    await this.notifyOperators(request, null)

    return { accepted: true }
  }

  async approveResidentPasswordResetRequest(
    input: unknown
  ): Promise<SupportPasswordResetApprovalResult> {
    const values = supportPasswordResetApprovalSchema.parse(input)
    const context = await this.authService.requirePermission("residents.manage")
    const previous = assertFound(
      await this.supportRepository.getById(values.requestId, values.organizationId),
      "Password reset request not found."
    )

    this.authService.requireHostelAccess(context, previous.organization_id, previous.hostel_id)

    if (!previous.resident_id || !isResidentPasswordResetRequest(previous)) {
      throw badRequest("This support request is not a resident password reset request.")
    }

    const reset = await new ResidentsService(this.db).resetResidentTemporaryPassword({
      organizationId: previous.organization_id,
      residentId: previous.resident_id,
    })
    const approvedAt = new Date().toISOString()
    const request = await this.supportRepository.update(
      previous.id,
      previous.organization_id,
      {
        status: "waiting_on_resident",
        resolution_notes:
          `Temporary password generated. Share it only after identity verification. ` +
          `It expires ${reset.expiresAt}.`,
        metadata: {
          ...recordFromUnknown(previous.metadata),
          passwordReset: {
            approvedAt,
            approvedBy: context.authUser.id,
            expiresAt: reset.expiresAt,
          },
        } satisfies Json,
        updated_by: context.authUser.id,
      }
    )

    await this.audit("support.password_reset.approved", context, request, previous, request)

    return {
      request,
      reset,
    }
  }

  async updateRequest(input: unknown) {
    const values = supportRequestUpdateSchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_PORTAL_ROLES)

    const previous = assertFound(
      await this.supportRepository.getById(values.requestId, values.organizationId),
      "Support request not found."
    )
    this.authService.requireHostelAccess(context, previous.organization_id, previous.hostel_id)

    const now = new Date().toISOString()
    const nextStatus = values.status ?? previous.status
    const request = await this.supportRepository.update(
      values.requestId,
      values.organizationId,
      {
        status: values.status,
        priority: values.priority,
        assigned_to_user_id: values.assignedToUserId,
        resolution_notes: values.resolutionNotes,
        resolved_at: nextStatus === "resolved" ? now : previous.resolved_at,
        closed_at: nextStatus === "closed" ? now : previous.closed_at,
        updated_by: context.authUser.id,
      }
    )

    await this.audit("support.request.updated", context, request, previous, request)

    if (request.resident_id && request.status === "waiting_on_resident") {
      await this.notifyResident(request, context)
    }

    return request
  }

  async getOperationalAlerts(input: unknown): Promise<OperationalAlert[]> {
    const values = operationalAlertsQuerySchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_PORTAL_ROLES)
    const organizationId = values.organizationId ?? context.organizationId
    const hostelId = values.hostelId ?? context.hostelIds[0] ?? null

    if (!organizationId) {
      return [
        {
          id: "setup.organization",
          severity: "critical",
          title: "Organization setup is incomplete",
          description: "Finish the admin setup wizard before residents can be supported safely.",
          count: 1,
          href: "/admin/setup",
          ctaLabel: "Open setup",
        },
      ]
    }

    this.authService.requireHostelAccess(context, organizationId, hostelId)

    const alerts: OperationalAlert[] = []
    const [
      passwordResetCount,
      urgentSupportCount,
      pendingSupportCount,
      onboardingPending,
      onboardingRejected,
      pendingPayments,
      failedPayments,
      vacancy,
      hasActivePaymentSettings,
      consistency,
      failedJobCount,
    ] = await Promise.all([
      this.supportRepository.countPasswordResetRequests({
        organizationId,
        hostelId,
        status: ["open", "in_progress"],
      }),
      this.supportRepository.count({
        organizationId,
        hostelId,
        status: ["open", "in_progress", "waiting_on_resident"],
        priority: ["high", "urgent"],
      }),
      this.supportRepository.count({
        organizationId,
        hostelId,
        status: ["open", "in_progress", "waiting_on_resident"],
      }),
      this.countOnboardingQueue(organizationId, hostelId ?? undefined, [
        "profile_incomplete",
        "documents_pending",
        "verification_pending",
      ]),
      this.countOnboardingQueue(organizationId, hostelId ?? undefined, ["rejected"]),
      this.countPayments(organizationId, hostelId ?? undefined, "pending"),
      this.countPayments(organizationId, hostelId ?? undefined, "failed"),
      this.loadVacancy(organizationId, hostelId ?? undefined),
      this.hasActivePaymentSettings(organizationId, hostelId ?? undefined),
      scanConsistency(this.operationsRepository, {
        organizationId,
        hostelId,
        actorUserId: context.authUser.id,
      }),
      this.operationsRepository.count("audit_logs", {
        organizationId,
        equals: { action: "job.failed" },
        gte: {
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
      }),
    ])

    if (passwordResetCount > 0) {
      alerts.push({
        id: "support.password_reset",
        severity: "high",
        title: "Resident password reset requests",
        description:
          "Existing residents are waiting for identity verification and a temporary password.",
        count: passwordResetCount,
        href: "/admin/password-resets",
        ctaLabel: "Issue passwords",
      })
    }

    if (urgentSupportCount > 0) {
      alerts.push({
        id: "support.urgent",
        severity: "high",
        title: "Urgent recovery requests need attention",
        description: "Residents are blocked by onboarding, payment, upload, or account issues.",
        count: urgentSupportCount,
        href: "/admin/alerts?priority=urgent",
        ctaLabel: "Review requests",
      })
    }

    if (pendingSupportCount > 0) {
      alerts.push({
        id: "support.open",
        severity: "medium",
        title: "Open support requests",
        description: "Resolve or assign open operational recovery requests.",
        count: pendingSupportCount,
        href: "/admin/alerts",
        ctaLabel: "Open queue",
      })
    }

    if (onboardingPending > 0) {
      alerts.push({
        id: "onboarding.pending",
        severity: "medium",
        title: "Resident onboarding needs verification",
        description: "Residents cannot access full operations until profile and documents are reviewed.",
        count: onboardingPending,
        href: "/admin/residents/verification",
        ctaLabel: "Open verification",
      })
    }

    if (onboardingRejected > 0) {
      alerts.push({
        id: "onboarding.rejected",
        severity: "high",
        title: "Rejected onboarding requires follow-up",
        description: "Residents need clear correction guidance or document re-upload support.",
        count: onboardingRejected,
        href: "/admin/residents/verification?status=rejected",
        ctaLabel: "Review rejections",
      })
    }

    if (pendingPayments > 0) {
      alerts.push({
        id: "payments.pending",
        severity: "medium",
        title: "Payments pending finance review",
        description: "Verify proof, UTR/reference, and bank entry before generating invoices.",
        count: pendingPayments,
        href: "/admin/payments?status=pending",
        ctaLabel: "Verify payments",
      })
    }

    if (failedPayments > 0) {
      alerts.push({
        id: "payments.rejected",
        severity: "high",
        title: "Rejected payments need resident guidance",
        description: "Residents may need to upload clearer proof or correct a UPI reference.",
        count: failedPayments,
        href: "/admin/payments?status=failed",
        ctaLabel: "Review rejected",
      })
    }

    if (vacancy && vacancy.available_beds <= 5) {
      alerts.push({
        id: "capacity.low",
        severity: vacancy.available_beds <= 0 ? "critical" : "high",
        title: vacancy.available_beds <= 0 ? "No student vacancy" : "Capacity risk",
        description: `Only ${vacancy.available_beds} student vacancies are currently available after occupancy.`,
        count: vacancy.available_beds,
        href: "/admin/vacancy",
        ctaLabel: "Check vacancy",
      })
    }

    if (hostelId && !hasActivePaymentSettings) {
      alerts.push({
        id: "payments.config_missing",
        severity: "critical",
        title: "Payment receiving account is not configured",
        description: "Residents cannot safely submit UPI payments until QR/UPI settings are active.",
        count: 1,
        href: "/admin/finance/payment-security",
        ctaLabel: "Configure payment",
      })
    }

    if (!areCronJobsEnabled()) {
      alerts.push({
        id: "operations.cron_disabled",
        severity: "high",
        title: "Automation jobs are disabled",
        description:
          "Scheduled reminders, expiry cleanup, consistency scans, and occupancy refreshes will not run until cron is re-enabled.",
        count: 1,
        href: "/admin/launch-readiness",
        ctaLabel: "Review launch controls",
      })
    }

    if (!areOperationalRepairsEnabled()) {
      alerts.push({
        id: "operations.repairs_disabled",
        severity: "medium",
        title: "Emergency repair execution is paused",
        description:
          "Consistency dry runs still work, but operators cannot execute repair actions until the repair kill switch is enabled.",
        count: 1,
        href: "/admin/launch-readiness",
        ctaLabel: "Review launch controls",
      })
    }

    if (consistency.summaries.critical > 0 || consistency.summaries.high > 0) {
      const priorityFindings = consistency.findings
        .filter((finding) => finding.severity === "critical" || finding.severity === "high")
        .slice(0, 3)
      const findingSummary = priorityFindings.length
        ? priorityFindings
            .map((finding) => `${finding.title} (${finding.count})`)
            .join("; ")
        : "Review the latest consistency findings."

      alerts.push({
        id: "operations.consistency",
        severity: consistency.summaries.critical > 0 ? "critical" : "high",
        title: priorityFindings[0]?.title ?? "Operational consistency needs repair",
        description: findingSummary,
        count: consistency.summaries.critical + consistency.summaries.high,
        href: "/admin/operations/automation",
        ctaLabel: "Open automation",
      })
    }

    if (failedJobCount > 0) {
      alerts.push({
        id: "operations.failed_jobs",
        severity: "high",
        title: "Automation jobs failed in the last 24 hours",
        description:
          "Review cron history before relying on reminders, expiry cleanup, invoices, or occupancy metrics.",
        count: failedJobCount,
        href: "/admin/operations/automation",
        ctaLabel: "Review jobs",
      })
    }

    return alerts
  }

  private async resolveSupportScope(
    context: AuthContext,
    input: {
      organizationId?: string
      hostelId?: string
      residentId?: string
    }
  ) {
    const organizationId = input.organizationId ?? context.organizationId

    if (!organizationId) {
      throw badRequest("Organization setup is required before support requests can be created.")
    }

    const isAdmin = context.roles.some((role) =>
      (ADMIN_PORTAL_ROLES as readonly string[]).includes(role)
    )

    if (isAdmin) {
      const hostelId = this.authService.resolveHostelScope(
        context,
        organizationId,
        input.hostelId ?? context.hostelIds[0]
      )

      if (!hostelId) {
        throw badRequest("Hostel setup is required before support requests can be managed.")
      }

      return {
        organizationId,
        hostelId,
        forceResidentId: null,
      }
    }

    const resident = await this.residentsRepository.getByUserId(
      context.authUser.id,
      organizationId
    )

    if (!resident) {
      throw forbidden("Your resident profile is not linked yet. Contact hostel administration.")
    }

    return {
      organizationId,
      hostelId: resident.hostel_id,
      forceResidentId: resident.id,
    }
  }

  private async resolvePublicSupportTenant(organizationId?: string, hostelId?: string) {
    const resolvedOrganizationId =
      organizationId || process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID
    const resolvedHostelId = hostelId || process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID

    if (resolvedOrganizationId && resolvedHostelId) {
      return {
        organizationId: resolvedOrganizationId,
        hostelId: resolvedHostelId,
      }
    }

    const defaultTenant = await new AdmissionsRepository(this.db).getDefaultTenant()

    if (!defaultTenant?.organizationId || !defaultTenant.hostelId) {
      throw badRequest("Hostel setup is required before password reset requests can be created.")
    }

    return {
      organizationId: defaultTenant.organizationId,
      hostelId: defaultTenant.hostelId,
    }
  }

  private async countOnboardingQueue(
    organizationId: string,
    hostelId: string | undefined,
    statuses: Array<"profile_incomplete" | "documents_pending" | "verification_pending" | "rejected">
  ) {
    const result = await this.residentsRepository.listOnboardingQueue({
      organizationId,
      hostelId,
      onboardingStatuses: statuses,
      page: 1,
      pageSize: 1,
    })

    return result.meta.total
  }

  private async countPayments(
    organizationId: string,
    hostelId: string | undefined,
    status: "pending" | "failed"
  ) {
    const result = await this.paymentsRepository.list({
      organizationId,
      hostelId,
      status,
      page: 1,
      pageSize: 1,
    })

    return result.meta.total
  }

  private async loadVacancy(organizationId: string, hostelId?: string) {
    try {
      const admissionsService = new AdmissionsService(this.db)
      const payload = await admissionsService.getVacancy({ organizationId, hostelId })

      return payload.summary
    } catch (error) {
      logError(error, {
        event: "support.alerts.vacancy_failed",
        organizationId,
        hostelId,
      })

      return null
    }
  }

  private async hasActivePaymentSettings(organizationId: string, hostelId?: string) {
    if (!hostelId) {
      return false
    }

    const setting = await this.paymentSettingsRepository.getActive(organizationId, hostelId)

    return Boolean(setting)
  }

  private async audit(
    action: string,
    context: AuthContext,
    request: SupportRequestRow,
    oldValues: SupportRequestRow | null,
    newValues: SupportRequestRow | null
  ) {
    return this.auditWithActor(action, context.authUser.id, request, oldValues, newValues)
  }

  private async auditWithActor(
    action: string,
    actorUserId: string | null,
    request: SupportRequestRow,
    oldValues: SupportRequestRow | null,
    newValues: SupportRequestRow | null
  ) {
    try {
      await this.supportRepository.createAuditLog({
        organization_id: request.organization_id,
        hostel_id: request.hostel_id,
        actor_user_id: actorUserId,
        table_name: "support_requests",
        record_id: request.id,
        action,
        old_values: oldValues as unknown as Json,
        new_values: newValues as unknown as Json,
        request_id: getRequestId(),
        metadata: {
          category: request.category,
          priority: request.priority,
          status: request.status,
          recovery: true,
        },
        created_by: actorUserId,
        updated_by: actorUserId,
      })
    } catch (error) {
      logError(error, {
        event: "support.audit_failed",
        organizationId: request.organization_id,
        requestId: request.id,
      })
    }
  }

  private async notifyOperators(request: SupportRequestRow, actorUserId: string | null) {
    try {
      await this.notificationService.queue({
        organizationId: request.organization_id,
        hostelId: request.hostel_id,
        channel: "in_app",
        recipient: {},
        actorUserId,
        message: {
          title: "New resident support request",
          body: `${request.subject} (${request.priority})`,
          templateKey: "support.request.created",
          payload: {
            requestId: request.id,
            category: request.category,
            priority: request.priority,
          },
        },
      })
    } catch (error) {
      logError(error, {
        event: "support.notification_failed",
        organizationId: request.organization_id,
        requestId: request.id,
      })
    }
  }

  private async notifyResident(request: SupportRequestRow, context: AuthContext) {
    try {
      await this.notificationService.queue({
        organizationId: request.organization_id,
        hostelId: request.hostel_id,
        channel: "in_app",
        recipient: {
          residentId: request.resident_id,
        },
        actorUserId: context.authUser.id,
        message: {
          title: "Support request needs your action",
          body: request.resolution_notes || "Hostel staff requested more details.",
          templateKey: "support.request.waiting_on_resident",
          payload: {
            requestId: request.id,
          },
        },
      })
    } catch (error) {
      logError(error, {
        event: "support.resident_notification_failed",
        organizationId: request.organization_id,
        requestId: request.id,
      })
    }
  }
}

export function buildRecoveryGuidance(category: SupportCategory): RecoveryGuidance {
  const shared = {
    primaryActionLabel: "Open support center",
    primaryActionHref: "/resident/support",
  }

  switch (category) {
    case "onboarding":
      return {
        ...shared,
        title: "Onboarding recovery",
        summary: "You can correct rejected details and re-submit for admin verification.",
        steps: [
          "Open resident onboarding and review missing or rejected sections.",
          "Re-upload clearer Aadhaar, photo, or student ID documents if requested.",
          "Submit for verification again after all required items are complete.",
        ],
      }
    case "payment":
      return {
        ...shared,
        title: "Payment recovery",
        summary: "Rejected payments usually need a clearer screenshot or corrected UPI reference.",
        steps: [
          "Check the rejection reason in payment history.",
          "Use the latest hostel QR/UPI details before paying again.",
          "Upload a fresh screenshot and enter the exact UTR/reference.",
        ],
      }
    case "invite":
      return {
        ...shared,
        title: "Invite recovery",
        summary: "Expired or used invite links must be reissued by hostel administration.",
        steps: [
          "Contact the hostel admin from WhatsApp or support.",
          "Ask them to resend your resident activation invite.",
          "Use the latest link only once and set your password immediately.",
        ],
      }
    case "upload":
      return {
        ...shared,
        title: "Upload recovery",
        summary: "Failed uploads can be retried with a supported image or PDF.",
        steps: [
          "Check that the file is clear and below the allowed size limit.",
          "Use PNG, JPG, WebP, or PDF only where the form allows it.",
          "Reconnect to the internet and retry the upload from the same screen.",
        ],
      }
    case "room":
      return {
        ...shared,
        title: "Room or vacancy recovery",
        summary: "Room conflicts are resolved by staff after checking live vacancy.",
        steps: [
          "Avoid repeating the same action in multiple tabs.",
          "Contact staff if your allocation or reservation looks incorrect.",
          "Staff can re-check vacancy and assign another room if needed.",
        ],
      }
    case "account":
    case "session":
      return {
        ...shared,
        title: "Account recovery",
        summary: "Session or account access issues can be recovered without developer help.",
        steps: [
          "Try logging out and signing in again.",
          "Use forgot password if your password no longer works.",
          "Contact hostel administration if your account is suspended or locked.",
        ],
      }
    default:
      return {
        ...shared,
        title: "Operational support",
        summary: "Hostel staff can review this request and guide the next step.",
        steps: [
          "Describe what you were trying to do.",
          "Include any payment reference, invite code, or document type involved.",
          "Watch notifications for staff response or required action.",
        ],
      }
  }
}

function isResidentPasswordResetRequest(request: SupportRequestRow) {
  return recordFromUnknown(request.metadata).workflow === "resident_password_reset"
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function maskLast4(value: string) {
  const digits = value.replace(/\D/g, "")

  return digits.slice(-4) || null
}
