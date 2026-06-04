import "server-only"

import { areOperationalRepairsEnabled } from "@/config/launch"
import { hostelModules } from "@/config/hostel-modules"
import {
  formatResidentIdentityMode,
  getResidentIdentityMode,
  type ResidentIdentityMode,
} from "@/lib/resident-identity"
import { tryNormalizePhoneNumber } from "@/lib/identity"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { OperationsRepository } from "@/repositories/operations.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type {
  ConsistencyFinding,
  ConsistencyReport,
  ConsistencyRepairAction,
  ConsistencySeverity,
} from "@/types/operations"
import {
  consistencyReportQuerySchema,
  consistencyRepairSchema,
} from "@/validations/operations.validation"
import {
  isResidentEligibleForBilling,
  isResidentEligibleForOccupancy,
} from "@/services/analytics/operational-metrics"

import { AuthService } from "../auth.service"

type ScannerInput = {
  organizationId: string
  hostelId?: string | null
  runId?: string | null
  actorUserId?: string | null
  persist?: boolean
}

type ConsistencyFindingDetail = NonNullable<ConsistencyFinding["details"]>[number]

export class ConsistencyService {
  private readonly authService: AuthService
  private readonly repository: OperationsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.repository = new OperationsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new ConsistencyService(db)
  }

  async getReport(input: unknown) {
    const values = consistencyReportQuerySchema.parse(input)
    const context = await this.authService.requirePermission("admin.dashboard.view")
    const organizationId = values.organizationId ?? context.organizationId
    const hostelId = values.hostelId ?? context.hostelIds[0] ?? null

    if (!organizationId) {
      return buildReport({
        organizationId: "unassigned",
        hostelId,
        findings: [
          finding(
            "setup.missing_organization",
            "orphan_data",
            "critical",
            "Organization setup is missing",
            "Automation cannot safely reconcile data until the admin setup wizard is complete.",
            1,
            "review_manually"
          ),
        ],
      })
    }

    this.authService.requireHostelAccess(context, organizationId, hostelId)

    return scanConsistency(this.repository, {
      organizationId,
      hostelId,
      actorUserId: context.authUser.id,
    })
  }

  async repair(input: unknown) {
    const values = consistencyRepairSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    if (values.dryRun) {
      const report = await scanConsistency(this.repository, {
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        actorUserId: context.authUser.id,
      })
      const repairableCount = report.findings.filter(
        (finding) =>
          values.action === "run_consistency_scan" ||
          finding.repairAction === values.action ||
          finding.details?.some((detail) => detail.recommendedRepairAction === values.action)
      ).length

      return {
        repaired: 0,
        dryRun: true,
        message: `Dry run completed. ${repairableCount} matching finding(s) would be reviewed by the safe repair. No records were changed.`,
        report,
      }
    }

    if (!areOperationalRepairsEnabled()) {
      const report = await scanConsistency(this.repository, {
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        actorUserId: context.authUser.id,
      })

      return {
        repaired: 0,
        dryRun: true,
        message:
          "Emergency repair execution is disabled by OPERATIONAL_REPAIRS_ENABLED=false. Dry-run diagnostics were returned and no records were changed.",
        report,
      }
    }

    if (values.action === "recalculate_occupancy" || values.action === "release_stale_allocations") {
      if (values.hostelId) {
        const repair = await this.repository.repairOccupancyConsistency({
          organizationId: values.organizationId,
          hostelId: values.hostelId,
          actorUserId: context.authUser.id,
        })
        const report = await scanConsistency(this.repository, {
          organizationId: values.organizationId,
          hostelId: values.hostelId,
          actorUserId: context.authUser.id,
          persist: true,
        })
        const repaired =
          (repair?.invalidAllocationsRepaired ?? 0) +
          (repair?.duplicateAllocationsRepaired ?? 0) +
          (repair?.hostelsRecalculated ?? 0)

        return {
          repaired,
          dryRun: false,
          message:
            `Occupancy repaired: ${repair?.invalidAllocationsRepaired ?? 0} invalid allocation(s), ` +
            `${repair?.duplicateAllocationsRepaired ?? 0} duplicate allocation(s), ` +
            `${repair?.hostelsRecalculated ?? 0} hostel snapshot(s) recalculated.`,
          report,
        }
      }

      return {
        repaired: 0,
        dryRun: false,
        message: "Choose a hostel before recalculating capacity.",
      }
    }

    if (values.action === "dedupe_invites" || values.action === "resync_auth_linkage") {
      const repair = await this.repository.repairOnboardingAccessConsistency({
        organizationId: values.organizationId,
        hostelId: values.hostelId ?? null,
        actorUserId: context.authUser.id,
      })
      const report = await scanConsistency(this.repository, {
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        actorUserId: context.authUser.id,
        persist: true,
      })
      const repaired =
        (repair?.expiredCount ?? 0) +
        (repair?.activatedInvitesRevokedCount ?? 0) +
        (repair?.duplicateInvitesRevokedCount ?? 0) +
        (repair?.authProfilesSyncedCount ?? 0) +
        (repair?.deadlockResidentsAdvancedCount ?? 0)

      return {
        repaired,
        dryRun: false,
        message:
          `Onboarding access repaired: ${repair?.expiredCount ?? 0} expired invite(s), ` +
          `${repair?.activatedInvitesRevokedCount ?? 0} stale invite(s) revoked, ` +
          `${repair?.duplicateInvitesRevokedCount ?? 0} duplicate invite(s) revoked, ` +
          `${repair?.authProfilesSyncedCount ?? 0} auth profile(s) resynced, ` +
          `${repair?.deadlockResidentsAdvancedCount ?? 0} partial activation state(s) advanced.`,
        report,
      }
    }

    if (values.action === "reconcile_dues") {
      const repair = await this.repository.reconcileInvalidDues({
        organizationId: values.organizationId,
        hostelId: values.hostelId ?? null,
        actorUserId: context.authUser.id,
      })
      const report = await scanConsistency(this.repository, {
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        actorUserId: context.authUser.id,
        persist: true,
      })
      const repaired =
        (repair?.feeRecordsCancelled ?? 0) + (repair?.invoicesCancelled ?? 0)

      return {
        repaired,
        dryRun: false,
        message:
          `Dues reconciled: ${repair?.feeRecordsCancelled ?? 0} invalid fee record(s) cancelled, ` +
          `${repair?.invoicesCancelled ?? 0} unpaid invoice(s) cancelled.`,
        report,
      }
    }

    if (values.action === "repair_analytics") {
      const repair = await this.repository.repairAnalyticsConsistency({
        organizationId: values.organizationId,
        hostelId: values.hostelId ?? null,
        actorUserId: context.authUser.id,
      })
      const report = await scanConsistency(this.repository, {
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        actorUserId: context.authUser.id,
        persist: true,
      })

      return {
        repaired: repair?.hostelsRecalculated ?? 0,
        dryRun: false,
        message: `Analytics repaired: ${repair?.hostelsRecalculated ?? 0} hostel snapshot(s) recalculated.`,
        report,
      }
    }

    if (values.action === "repair_tenant_linkage") {
      if (!context.roles.some((role) => role === "owner" || role === "admin" || role === "super_admin")) {
        return {
          repaired: 0,
          dryRun: false,
          message: "Only owners and admins can repair tenant linkage records.",
        }
      }

      const repair = await this.repository.repairTenantLinkageConsistency({
        organizationId: values.organizationId,
        hostelId: values.hostelId ?? null,
        actorUserId: context.authUser.id,
      })
      const report = await scanConsistency(this.repository, {
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        actorUserId: context.authUser.id,
        persist: true,
      })
      const repaired =
        (repair?.roomAllocationsRepaired ?? 0) +
        (repair?.monthlyFeeRecordsRepaired ?? 0) +
        (repair?.invoicesRepaired ?? 0) +
        (repair?.paymentsRepaired ?? 0) +
        (repair?.residentInvitesRepaired ?? 0) +
        (repair?.reservationsRepaired ?? 0) +
        (repair?.reservationPaymentsRepaired ?? 0) +
        (repair?.documentsRepaired ?? 0) +
        (repair?.hostelsRecalculated ?? 0)

      return {
        repaired,
        dryRun: false,
        message:
          `Tenant linkage repaired: ${repair?.paymentsRepaired ?? 0} payment(s), ` +
          `${repair?.residentInvitesRepaired ?? 0} invite(s), ` +
          `${repair?.reservationPaymentsRepaired ?? 0} reservation payment(s), ` +
          `${repair?.roomAllocationsRepaired ?? 0} allocation(s), ` +
          `${repair?.documentsRepaired ?? 0} document(s), ` +
          `${repair?.hostelsRecalculated ?? 0} hostel snapshot(s) recalculated. ` +
          "Cross-organization and ambiguous mismatches remain manual.",
        report,
      }
    }

    if (values.action === "run_consistency_scan") {
      const report = await scanConsistency(this.repository, {
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        actorUserId: context.authUser.id,
        persist: true,
      })

      return {
        repaired: 0,
        dryRun: false,
        message: "Consistency scan recorded.",
        report,
      }
    }

    return {
      repaired: 0,
      dryRun: false,
      message: "Use the automation runner for this repair action.",
    }
  }
}

export async function scanConsistency(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyReport> {
  const now = new Date()
  const staleUploadCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const onboardingCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const findings: ConsistencyFinding[] = []

  const [
    staleReservations,
    expiredInvites,
    staleUploads,
    staleOnboarding,
    verifiedPaymentWithoutInvoice,
    verifiedPaymentWithoutReference,
    invoiceWithoutPdf,
    activeAllocationsPastEndDate,
    staleReservationRows,
    expiredInviteRows,
    staleUploadRows,
    staleOnboardingRows,
    unreconciledPaymentRows,
    invoiceWithoutPdfRows,
    activeAllocationsPastEndDateRows,
  ] = await Promise.all([
    repository.count("reservations", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      in: { status: ["pending", "reserved", "confirmed"] },
      lte: { reserved_until: now.toISOString() },
      deletedAtNull: true,
    }),
    repository.count("resident_invites", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      equals: { status: "pending" },
      lte: { expires_at: now.toISOString() },
    }),
    repository.count("documents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      equals: { status: "pending" },
      lte: { created_at: staleUploadCutoff },
      deletedAtNull: true,
    }),
    repository.count("residents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      in: {
        onboarding_status: [
          "invited",
          "activated",
          "profile_incomplete",
          "documents_pending",
          "rejected",
        ],
      },
      lte: { updated_at: onboardingCutoff },
      deletedAtNull: true,
    }),
    repository.count("payments", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      equals: { status: "verified", method: "upi", is_advance: false },
      isNull: ["invoice_id"],
      deletedAtNull: true,
    }),
    repository.count("payments", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      equals: { status: "verified", method: "upi" },
      isNull: ["transaction_id"],
      deletedAtNull: true,
    }),
    repository.count("invoices", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      isNull: ["pdf_document_id"],
      deletedAtNull: true,
    }),
    hostelModules.roomAllocation
      ? repository.count("room_allocations", {
          organizationId: input.organizationId,
          hostelId: input.hostelId,
          equals: { status: "active" },
          lte: { allocated_to: now.toISOString().slice(0, 10) },
          deletedAtNull: true,
        })
      : Promise.resolve(0),
    repository.list("reservations", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,lead_id,converted_resident_id,status,reserved_until",
      in: { status: ["pending", "reserved", "confirmed"] },
      lte: { reserved_until: now.toISOString() },
      deletedAtNull: true,
      limit: 20,
    }),
    repository.list("resident_invites", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,resident_id,status,expires_at,used_at,revoked_at",
      equals: { status: "pending" },
      lte: { expires_at: now.toISOString() },
      limit: 20,
    }),
    repository.list("documents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,resident_id,payment_id,invoice_id,status,created_at",
      equals: { status: "pending" },
      lte: { created_at: staleUploadCutoff },
      deletedAtNull: true,
      limit: 20,
    }),
    repository.list("residents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,status,onboarding_status,user_id,updated_at",
      in: {
        onboarding_status: [
          "invited",
          "activated",
          "profile_incomplete",
          "documents_pending",
          "rejected",
        ],
      },
      lte: { updated_at: onboardingCutoff },
      deletedAtNull: true,
      limit: 20,
    }),
    repository.list("payments", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,resident_id,status,method,is_advance,invoice_id,transaction_id",
      equals: { status: "verified" },
      deletedAtNull: true,
      limit: 40,
    }),
    repository.list("invoices", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,resident_id,status,pdf_document_id",
      isNull: ["pdf_document_id"],
      deletedAtNull: true,
      limit: 20,
    }),
    hostelModules.roomAllocation
      ? repository.list("room_allocations", {
          organizationId: input.organizationId,
          hostelId: input.hostelId,
          select: "id,organization_id,hostel_id,resident_id,room_id,status,allocated_to",
          equals: { status: "active" },
          lte: { allocated_to: now.toISOString().slice(0, 10) },
          deletedAtNull: true,
          limit: 20,
        })
      : Promise.resolve([]),
  ])

  if (staleReservations > 0) {
    findings.push(
      finding(
        "reservations.expired_pending",
        "reservation",
        "high",
        "Expired reservations still hold student spots",
        "Reservations past reserved_until can block public vacancy and overstate reserved capacity.",
        staleReservations,
        "expire_reservations",
        rowDetails(staleReservationRows, {
          tableName: "reservations",
          anomalyType: "expired_reservation_holding_bed",
          expectedState: "reservation expired or released after reserved_until",
          actualState: "pending/reserved/confirmed after reserved_until",
          repairAction: "expire_reservations",
          recommendation: "Run reservation expiry automation to release stale reserved capacity.",
        })
      )
    )
  }

  if (expiredInvites > 0) {
    findings.push(
      finding(
        "invites.expired_pending",
        "invite",
        "medium",
        "Expired resident invites are still pending",
        "Pending expired invites should be marked expired to prevent stale activation recovery confusion.",
        expiredInvites,
        "expire_invites",
        rowDetails(expiredInviteRows, {
          tableName: "resident_invites",
          anomalyType: "expired_invite_pending",
          expectedState: "status expired once expires_at passes",
          actualState: "pending after expires_at",
          repairAction: "dedupe_invites",
          recommendation: "Run onboarding access repair to expire stale invites and keep only one active invite per resident.",
        })
      )
    )
  }

  if (staleUploads > 0) {
    findings.push(
      finding(
        "uploads.stale_pending",
        "upload",
        "medium",
        "Stale uploads need cleanup",
        "Pending upload metadata older than 24 hours can indicate interrupted document or proof uploads.",
        staleUploads,
        "cleanup_uploads",
        rowDetails(staleUploadRows, {
          tableName: "documents",
          anomalyType: "stale_pending_upload",
          expectedState: "upload verified, rejected, or cleaned up within 24 hours",
          actualState: "pending upload metadata older than 24 hours",
          repairAction: "cleanup_uploads",
          recommendation: "Run stale upload cleanup or ask the resident/admin to retry the failed upload.",
        })
      )
    )
  }

  if (staleOnboarding > 0) {
    findings.push(
      finding(
        "onboarding.stale",
        "onboarding",
        "medium",
        "Resident onboarding is aging",
        "Incomplete onboarding older than 7 days needs reminder, admin follow-up, or suspension review.",
        staleOnboarding,
        "review_manually",
        rowDetails(staleOnboardingRows, {
          tableName: "residents",
          anomalyType: "stale_onboarding_state",
          expectedState: "onboarding progresses or is followed up within 7 days",
          actualState: "incomplete onboarding older than 7 days",
          repairAction: "review_manually",
          recommendation: "Contact the resident, resend activation, or suspend/reject stale onboarding from the admin queue.",
        })
      )
    )
  }

  if (verifiedPaymentWithoutInvoice > 0 || verifiedPaymentWithoutReference > 0) {
    findings.push(
      finding(
        "payments.reconciliation",
        "payment",
        "critical",
        "Payment reconciliation mismatch",
        "Verified UPI payments must have invoice linkage and transaction references for audit safety.",
        verifiedPaymentWithoutInvoice + verifiedPaymentWithoutReference,
        "reconcile_dues",
        rowDetails(
          unreconciledPaymentRows.filter((payment) => {
            const status = stringValue(payment, "status")
            const method = stringValue(payment, "method")

            return (
              status === "verified" &&
              method === "upi" &&
              (!stringValue(payment, "invoice_id") || !stringValue(payment, "transaction_id"))
            )
          }),
          {
            tableName: "payments",
            anomalyType: "verified_payment_reconciliation_mismatch",
            expectedState: "verified UPI payment has invoice and transaction reference",
            actualState: "verified UPI payment missing invoice_id or transaction_id",
            repairAction: "reconcile_dues",
            recommendation: "Reconcile the ledger and manually review verified payments missing audit references.",
          }
        )
      )
    )
  }

  if (invoiceWithoutPdf > 0) {
    findings.push(
      finding(
        "invoices.pdf_missing",
        "invoice",
        "high",
        "Invoices missing PDFs",
        "Invoice records without PDF documents can block resident downloads and audit exports.",
        invoiceWithoutPdf,
        "review_manually",
        rowDetails(invoiceWithoutPdfRows, {
          tableName: "invoices",
          anomalyType: "invoice_pdf_missing",
          expectedState: "invoice has generated PDF document",
          actualState: "invoice pdf_document_id is missing",
          repairAction: "review_manually",
          recommendation: "Regenerate invoice PDFs before resident download or owner export.",
        })
      )
    )
  }

  if (activeAllocationsPastEndDate > 0) {
    findings.push(
      finding(
        "allocations.past_end_date",
        "occupancy",
        "high",
        "Room allocations ended but remain active",
        "Active allocations with past end dates can inflate occupied students and dues generation.",
        activeAllocationsPastEndDate,
        "release_stale_allocations",
        rowDetails(activeAllocationsPastEndDateRows, {
          tableName: "room_allocations",
          anomalyType: "active_allocation_past_end_date",
          expectedState: "allocation completed when allocated_to has passed",
          actualState: "active allocation with allocated_to in the past",
          repairAction: "release_stale_allocations",
          recommendation: "Run occupancy repair to close stale allocations and recompute vacancy.",
        })
      )
    )
  }

  findings.push(...await detectDuplicateResidents(repository, input))
  findings.push(...await detectDuplicateInviteAnomalies(repository, input, now))
  findings.push(...await detectOnboardingAuthDeadlocks(repository, input))
  findings.push(...await detectPhoneIdentityAnomalies(repository, input))
  findings.push(...await detectResidentTenantIdentityAnomalies(repository, input))
  if (hostelModules.roomAllocation) {
    findings.push(...await detectResidentAllocationAnomalies(repository, input))
    findings.push(...await detectOverCapacityRooms(repository, input))
  }

  if (hostelModules.vacancy || hostelModules.roomAllocation || hostelModules.reservations) {
    findings.push(...await detectCapacitySnapshotAnomalies(repository, input))
  }
  findings.push(...await detectInvalidDuesAnomalies(repository, input))
  findings.push(...await detectBusinessTenantLinkageAnomalies(repository, input))
  findings.push(...await detectSecurityAnomalies(repository, input))

  const report = buildReport({
    organizationId: input.organizationId,
    hostelId: input.hostelId,
    findings,
  })

  if (input.persist) {
    await repository.recordConsistencyReport({
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      findings,
      score: report.score,
      runId: input.runId,
      actorUserId: input.actorUserId,
    })
  }

  return report
}

async function detectDuplicateResidents(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyFinding[]> {
  const residents = await repository.list("residents", {
    organizationId: input.organizationId,
    hostelId: input.hostelId,
    select: "id,phone,email,aadhaar_last4,full_name,status,is_active,user_id",
    deletedAtNull: true,
    limit: 2000,
  })
  const phones = new Map<string, number>()
  const emails = new Map<string, number>()
  const aadhaarIdentity = new Map<string, number>()
  const productionResidents = residents.filter((resident) => {
    const status = stringValue(resident, "status")

    return (
      booleanValue(resident, "is_active") === true &&
      (status === "active" || status === "suspended" || Boolean(stringValue(resident, "user_id")))
    )
  })

  productionResidents.forEach((resident) => {
    if (typeof resident.phone === "string" && resident.phone.trim()) {
      const phone = resident.phone.replace(/\D/g, "") || resident.phone.trim()

      phones.set(phone, (phones.get(phone) ?? 0) + 1)
    }

    if (typeof resident.email === "string" && resident.email.trim()) {
      const email = resident.email.trim().toLowerCase()

      emails.set(email, (emails.get(email) ?? 0) + 1)
    }

    if (
      typeof resident.aadhaar_last4 === "string" &&
      typeof resident.full_name === "string" &&
      resident.aadhaar_last4.trim()
    ) {
      const key = `${resident.full_name.trim().toLowerCase()}:${resident.aadhaar_last4}`
      aadhaarIdentity.set(key, (aadhaarIdentity.get(key) ?? 0) + 1)
    }
  })

  const duplicateCount =
    [...phones.values()].filter((count) => count > 1).length +
    [...emails.values()].filter((count) => count > 1).length +
    [...aadhaarIdentity.values()].filter((count) => count > 1).length
  const details: ConsistencyFindingDetail[] = [
    ...duplicateIdentityDetails(phones, "phone"),
    ...duplicateIdentityDetails(emails, "email"),
    ...duplicateIdentityDetails(aadhaarIdentity, "name_aadhaar_last4"),
  ]

  return duplicateCount > 0
    ? [
        finding(
          "residents.duplicates",
          "orphan_data",
          "high",
          "Duplicate production resident identities detected",
          "Active, suspended, or portal-linked residents share phone, email, or name plus Aadhaar-last-4. Draft admissions are ignored until activation.",
          duplicateCount,
          "review_manually",
          details.slice(0, 20)
        ),
      ]
    : []
}

async function detectDuplicateInviteAnomalies(
  repository: OperationsRepository,
  input: ScannerInput,
  now: Date
): Promise<ConsistencyFinding[]> {
  const activeInvites = await repository.list("resident_invites", {
    organizationId: input.organizationId,
    hostelId: input.hostelId,
    select: "id,organization_id,hostel_id,resident_id,status,expires_at,used_at,revoked_at,created_at",
    equals: { status: "pending" },
    isNull: ["used_at", "revoked_at"],
    gt: { expires_at: now.toISOString() },
    limit: 5000,
  })
  const countByResident = new Map<string, number>()

  activeInvites.forEach((invite) => {
    const residentId = stringValue(invite, "resident_id")

    if (residentId) {
      countByResident.set(residentId, (countByResident.get(residentId) ?? 0) + 1)
    }
  })

  const duplicateResidentIds = [...countByResident.entries()]
    .filter(([, count]) => count > 1)
    .map(([residentId]) => residentId)
  const duplicateInvites = activeInvites.filter((invite) => {
    const residentId = stringValue(invite, "resident_id")

    return Boolean(residentId && duplicateResidentIds.includes(residentId))
  })

  return duplicateResidentIds.length > 0
    ? [
        finding(
          "invites.duplicate_active",
          "invite",
          "high",
          "Residents have duplicate active invites",
          "Each resident should have only one usable activation path. Duplicate active invites can cause replay confusion and stale onboarding links.",
          duplicateResidentIds.length,
          "dedupe_invites",
          rowDetails(duplicateInvites.slice(0, 20), {
            tableName: "resident_invites",
            anomalyType: "duplicate_active_invite",
            expectedState: "one pending active invite per resident",
            actualState: "multiple pending unexpired invites for the same resident",
            repairAction: "dedupe_invites",
            recommendation: "Run onboarding access repair to revoke older active invites and retain the newest activation path.",
          })
        ),
      ]
    : []
}

async function detectOnboardingAuthDeadlocks(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyFinding[]> {
  const [residents, users, invites] = await Promise.all([
    repository.list("residents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,user_id,status,onboarding_status,full_name,phone,email,metadata,deleted_at",
      deletedAtNull: true,
      limit: 5000,
    }),
    repository.list("users", {
      organizationId: input.organizationId,
      select: "id,organization_id,is_active,default_role,metadata,deleted_at",
      limit: 5000,
    }),
    repository.list("resident_invites", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,resident_id,status,email,phone,metadata,used_at,revoked_at,expires_at",
      limit: 5000,
    }),
  ])
  const userById = indexById(users)
  const residentById = indexById(residents)
  const pendingInviteResidentIds = new Set(
    invites
      .filter((invite) => stringValue(invite, "status") === "pending")
      .map((invite) => stringValue(invite, "resident_id"))
      .filter((residentId): residentId is string => Boolean(residentId))
  )
  const verifiedWithoutAuth = residents.filter(
    (resident) =>
      stringValue(resident, "onboarding_status") === "verified" &&
      !stringValue(resident, "user_id")
  )
  const linkedWithoutUserProfile = residents.filter((resident) => {
    const userId = stringValue(resident, "user_id")

    return Boolean(userId && !userById.has(userId))
  })
  const draftWithAuthStillInvited = residents.filter((resident) => {
    const onboardingStatus = stringValue(resident, "onboarding_status")

    return Boolean(
      stringValue(resident, "user_id") &&
        stringValue(resident, "status") === "draft" &&
        (onboardingStatus === "invited" || onboardingStatus === "rejected")
    )
  })
  const noInviteAndNoAuth = residents.filter((resident) => {
    const status = stringValue(resident, "status")
    const onboardingStatus = stringValue(resident, "onboarding_status")
    const residentId = stringValue(resident, "id")

    return Boolean(
      residentId &&
        !stringValue(resident, "user_id") &&
        (status === "draft" || onboardingStatus === "invited") &&
        !pendingInviteResidentIds.has(residentId)
    )
  })
  const activeInvites = invites.filter((invite) => {
    const expiresAt = Date.parse(stringValue(invite, "expires_at") ?? "")

    return Boolean(
      stringValue(invite, "status") === "pending" &&
        !stringValue(invite, "used_at") &&
        !stringValue(invite, "revoked_at") &&
        Number.isFinite(expiresAt) &&
        expiresAt > Date.now()
    )
  })
  const inviteIdentityModeMismatches = activeInvites.filter((invite) => {
    const resident = residentById.get(stringValue(invite, "resident_id") ?? "")

    if (!resident) {
      return false
    }

    return getRowIdentityMode(invite) !== getRowIdentityMode(resident)
  })
  const authIdentityModeMismatches = residents.filter((resident) => {
    const userId = stringValue(resident, "user_id")
    const user = userId ? userById.get(userId) : null
    const actualMode = authMetadataIdentityMode(user)
    const expectedMode = getExpectedAuthIdentityMode(resident, user)

    return Boolean(actualMode && actualMode !== expectedMode)
  })
  const findings: ConsistencyFinding[] = []

  if (verifiedWithoutAuth.length > 0) {
    findings.push(
      finding(
        "onboarding.verified_without_auth",
        "onboarding",
        "critical",
        "Verified residents are missing auth linkage",
        "Residents cannot be operationally verified without a linked Supabase auth user and app user profile.",
        verifiedWithoutAuth.length,
        "resync_auth_linkage",
        rowDetails(verifiedWithoutAuth, {
          tableName: "residents",
          anomalyType: "verified_resident_missing_user_id",
          expectedState: "verified resident has user_id and active app user profile",
          actualState: "onboarding_status verified but user_id is missing",
          repairAction: "review_manually",
          recommendation: "Reopen activation or relink the resident from the onboarding review queue before granting dashboard access.",
        })
      )
    )
  }

  if (linkedWithoutUserProfile.length > 0 || draftWithAuthStillInvited.length > 0) {
    findings.push(
      finding(
        "onboarding.auth_linkage_deadlock",
        "onboarding",
        "high",
        "Resident auth linkage needs resync",
        "Some residents have partial activation state: auth user linked but app profile metadata or onboarding status is stale.",
        linkedWithoutUserProfile.length + draftWithAuthStillInvited.length,
        "resync_auth_linkage",
        [
          ...rowDetails(linkedWithoutUserProfile, {
            tableName: "residents",
            anomalyType: "linked_user_profile_missing",
            expectedState: "resident.user_id has active public.users profile in same organization",
            actualState: "resident.user_id set but public.users profile missing or out of scope",
            repairAction: "resync_auth_linkage",
            recommendation: "Run auth linkage repair to recreate/sync the app profile from the auth user when the auth identity exists.",
          }),
          ...rowDetails(draftWithAuthStillInvited, {
            tableName: "residents",
            anomalyType: "partial_activation_still_invited",
            expectedState: "draft resident with auth user moves to activated onboarding state",
            actualState: "resident has user_id but onboarding remains invited/rejected",
            repairAction: "resync_auth_linkage",
            recommendation: "Run auth linkage repair to advance partial activation to the activated onboarding state.",
          }),
        ].slice(0, 20)
      )
    )
  }

  if (noInviteAndNoAuth.length > 0) {
    findings.push(
      finding(
        "onboarding.no_access_path",
        "onboarding",
        "medium",
        "Draft residents are missing an access path",
        "Draft or invited residents without auth linkage and without a pending invite can become onboarding deadlocks.",
        noInviteAndNoAuth.length,
        "review_manually",
        rowDetails(noInviteAndNoAuth, {
          tableName: "residents",
          anomalyType: "draft_resident_missing_invite",
          expectedState: "draft resident has pending invite, temp password, or activation link",
          actualState: "no auth user and no pending invite",
          repairAction: "review_manually",
          recommendation: "Resend activation or create a fresh onboarding invite from the resident profile.",
        })
      )
    )
  }

  if (inviteIdentityModeMismatches.length > 0) {
    findings.push(
      finding(
        "onboarding.invite_identity_mode_mismatch",
        "onboarding",
        "high",
        "Invite identity mode does not match resident record",
        "Some pending invites ask residents to verify the wrong identity type. Revoke and resend access before activation.",
        inviteIdentityModeMismatches.length,
        "dedupe_invites",
        inviteIdentityModeMismatches.slice(0, 20).map((invite) => {
          const resident = residentById.get(stringValue(invite, "resident_id") ?? "")
          const expectedMode = resident ? getExpectedAuthIdentityMode(resident) : null
          const actualMode = getRowIdentityMode(invite)

          return {
            tableName: "resident_invites",
            recordId: stringValue(invite, "id"),
            residentId: stringValue(invite, "resident_id"),
            organizationId: stringValue(invite, "organization_id"),
            hostelId: stringValue(invite, "hostel_id"),
            anomalyType: "invite_identity_mode_mismatch",
            expectedState: expectedMode
              ? `activation requires ${formatResidentIdentityMode(expectedMode)}`
              : "resident exists with a clear activation identity mode",
            actualState: `invite is ${formatResidentIdentityMode(actualMode)}`,
            expectedOrganizationId: resident ? stringValue(resident, "organization_id") : null,
            actualOrganizationId: stringValue(invite, "organization_id"),
            expectedHostelId: resident ? stringValue(resident, "hostel_id") : null,
            actualHostelId: stringValue(invite, "hostel_id"),
            recommendedRepairAction: "dedupe_invites",
            recommendation: "Revoke stale invites and resend activation so the resident sees the correct phone/email verification step.",
          }
        })
      )
    )
  }

  if (authIdentityModeMismatches.length > 0) {
    findings.push(
      finding(
        "onboarding.auth_identity_mode_mismatch",
        "onboarding",
        "high",
        "Auth identity mode does not match resident record",
        "Some linked auth profiles carry stale phone/email activation metadata. Login may work, but recovery and diagnostics can guide the resident incorrectly.",
        authIdentityModeMismatches.length,
        "resync_auth_linkage",
        authIdentityModeMismatches.slice(0, 20).map((resident) => {
          const user = userById.get(stringValue(resident, "user_id") ?? "")
          const expectedMode = getExpectedAuthIdentityMode(resident, user)
          const actualMode = authMetadataIdentityMode(user)

          return {
            tableName: "residents",
            recordId: stringValue(resident, "id"),
            residentId: stringValue(resident, "id"),
            organizationId: stringValue(resident, "organization_id"),
            hostelId: stringValue(resident, "hostel_id"),
            anomalyType: "auth_identity_mode_mismatch",
            expectedState: `auth profile metadata is ${formatResidentIdentityMode(expectedMode)}`,
            actualState: actualMode
              ? `auth profile metadata is ${formatResidentIdentityMode(actualMode)}`
              : "auth profile metadata is missing identity mode",
            expectedOrganizationId: stringValue(resident, "organization_id"),
            actualOrganizationId: stringValue(user ?? {}, "organization_id"),
            expectedHostelId: stringValue(resident, "hostel_id"),
            actualHostelId: stringValue(resident, "hostel_id"),
            recommendedRepairAction: "resync_auth_linkage",
            recommendation: "Run auth linkage repair, then ask the resident to continue onboarding with the latest access instructions.",
          }
        })
      )
    )
  }

  return findings
}

async function detectPhoneIdentityAnomalies(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyFinding[]> {
  const [residents, users, invites] = await Promise.all([
    repository.list("residents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,phone,user_id,deleted_at",
      deletedAtNull: true,
      limit: 5000,
    }),
    repository.list("users", {
      organizationId: input.organizationId,
      select: "id,organization_id,phone,deleted_at",
      deletedAtNull: true,
      limit: 5000,
    }),
    repository.list("resident_invites", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,resident_id,phone,status,used_at,revoked_at",
      limit: 5000,
    }),
  ])
  const rows = [
    ...residents.map((record) => ({ tableName: "residents", record })),
    ...users.map((record) => ({ tableName: "users", record })),
    ...invites.map((record) => ({ tableName: "resident_invites", record })),
  ]
  const anomalies = rows
    .map(({ tableName, record }) => {
      const phone = stringValue(record, "phone")

      if (!phone) {
        return null
      }

      const normalized = tryNormalizePhoneNumber(phone)

      if (normalized && normalized === phone) {
        return null
      }

      return {
        tableName,
        record,
        normalized,
      }
    })
    .filter((value): value is {
      tableName: string
      record: Record<string, unknown>
      normalized: string | null
    } => Boolean(value))

  if (anomalies.length === 0) {
    return []
  }

  return [
    finding(
      "identity.phone_normalization_mismatch",
      "onboarding",
      "high",
      "Phone identities are not normalized",
      "Resident login, activation, and WhatsApp delivery require E.164 Indian mobile numbers. Mixed formats can make Supabase Auth reject valid residents.",
      anomalies.length,
      "review_manually",
      anomalies.slice(0, 20).map(({ tableName, record, normalized }) => ({
        tableName,
        recordId: stringValue(record, "id"),
        residentId:
          tableName === "residents"
            ? stringValue(record, "id")
            : stringValue(record, "resident_id"),
        organizationId: stringValue(record, "organization_id"),
        hostelId: stringValue(record, "hostel_id"),
        anomalyType: normalized ? "phone_not_e164" : "invalid_phone_identity",
        expectedState: normalized ?? "valid Indian E.164 mobile number",
        actualState: stringValue(record, "phone"),
        expectedOrganizationId: stringValue(record, "organization_id"),
        actualOrganizationId: stringValue(record, "organization_id"),
        expectedHostelId: stringValue(record, "hostel_id"),
        actualHostelId: stringValue(record, "hostel_id"),
        recommendedRepairAction: "review_manually",
        recommendation:
          "Correct the phone in the admin panel or apply the phone identity normalization migration, then resend activation if the resident still cannot log in.",
      }))
    ),
  ]
}

async function detectResidentTenantIdentityAnomalies(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyFinding[]> {
  const rows = await repository.listResidentTenantIdentityAnomalies({
    organizationId: input.organizationId,
    hostelId: input.hostelId,
    limit: 100,
  })

  if (rows.length === 0) {
    return []
  }

  return [
    finding(
      "security.resident_tenant_identity",
      "security",
      "critical",
      "Resident tenant identity needs repair",
      "Historical or partial resident records have missing tenant scope, invalid hostel linkage, or broken auth ownership. These rows are skipped by normalization and must be reviewed before activation, billing, or occupancy repair.",
      rows.length,
      "review_manually",
      rows.slice(0, 20).map((row) => ({
        tableName: stringValue(row, "table_name") ?? "residents",
        recordId: stringValue(row, "record_id"),
        residentId: stringValue(row, "resident_id"),
        organizationId: stringValue(row, "organization_id"),
        hostelId: stringValue(row, "hostel_id"),
        anomalyType: stringValue(row, "anomaly_type") ?? "resident_tenant_identity_anomaly",
        expectedState: stringValue(row, "expected_state"),
        actualState: stringValue(row, "actual_state"),
        expectedOrganizationId: stringValue(row, "expected_organization_id"),
        actualOrganizationId: stringValue(row, "organization_id"),
        expectedHostelId: stringValue(row, "expected_hostel_id"),
        actualHostelId: stringValue(row, "hostel_id"),
        recommendedRepairAction: "review_manually",
        recommendation:
          stringValue(row, "recommendation") ??
          "Review resident tenant, hostel, auth, invite, and audit history before repairing manually.",
      }))
    ),
  ]
}

async function detectOverCapacityRooms(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyFinding[]> {
  const [rooms, allocations] = await Promise.all([
    repository.list("rooms", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,capacity",
      deletedAtNull: true,
      limit: 2000,
    }),
    repository.list("room_allocations", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,room_id",
      equals: { status: "active" },
      deletedAtNull: true,
      limit: 5000,
    }),
  ])
  const activeByRoom = new Map<string, number>()
  const capacityByRoom = new Map<string, number>()

  rooms.forEach((room) => {
    if (typeof room.id === "string" && typeof room.capacity === "number") {
      capacityByRoom.set(room.id, room.capacity)
    }
  })

  allocations.forEach((allocation) => {
    if (typeof allocation.room_id === "string") {
      activeByRoom.set(allocation.room_id, (activeByRoom.get(allocation.room_id) ?? 0) + 1)
    }
  })

  const overCapacityRoomIds = [...activeByRoom.entries()].filter(
    ([roomId, activeCount]) => activeCount > (capacityByRoom.get(roomId) ?? 0)
  ).map(([roomId]) => roomId)
  const overCapacityCount = overCapacityRoomIds.length

  return overCapacityCount > 0
    ? [
        finding(
          "rooms.over_capacity",
          "occupancy",
          "critical",
          "Rooms exceed configured capacity",
          "Active allocations exceed room capacity. Run occupancy recalculation and manually inspect affected rooms.",
          overCapacityCount,
          "release_stale_allocations",
          overCapacityRoomIds.slice(0, 20).map((roomId) => ({
            tableName: "rooms",
            recordId: roomId,
            organizationId: input.organizationId,
            hostelId: input.hostelId ?? null,
            anomalyType: "room_over_capacity",
            expectedState: `active allocations <= capacity ${capacityByRoom.get(roomId) ?? 0}`,
            actualState: `active allocations ${activeByRoom.get(roomId) ?? 0}`,
            expectedOrganizationId: input.organizationId,
            actualOrganizationId: input.organizationId,
            expectedHostelId: input.hostelId ?? null,
            actualHostelId: input.hostelId ?? null,
            recommendedRepairAction: "release_stale_allocations",
            recommendation: "Run occupancy repair, then manually transfer or release residents if the room remains over capacity.",
          }))
        ),
      ]
    : []
}

async function detectCapacitySnapshotAnomalies(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyFinding[]> {
  const [snapshots, liveVacancy] = await Promise.all([
    repository.list("hostel_capacity", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "organization_id,hostel_id,total_beds,occupied_beds,reserved_beds,available_beds",
      limit: 100,
    }),
    repository.list("hostel_vacancy_view", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "organization_id,hostel_id,total_beds,occupied_beds,reserved_beds,available_beds",
      limit: 100,
    }),
  ])
  const snapshotByHostel = new Map(
    snapshots
      .map((snapshot) => [stringValue(snapshot, "hostel_id"), snapshot] as const)
      .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0]))
  )
  const mismatchCount = liveVacancy.filter((live) => {
    const hostelId = stringValue(live, "hostel_id")
    const snapshot = hostelId ? snapshotByHostel.get(hostelId) : null

    if (!snapshot) {
      return true
    }

    return (
      numberValue(snapshot, "occupied_beds") !== numberValue(live, "occupied_beds") ||
      numberValue(snapshot, "reserved_beds") !== numberValue(live, "reserved_beds") ||
      numberValue(snapshot, "available_beds") !== numberValue(live, "available_beds")
    )
  }).length

  return mismatchCount > 0
    ? [
        finding(
          "capacity.snapshot_mismatch",
          "occupancy",
          "high",
          "Vacancy snapshot is stale",
          "Stored hostel capacity no longer matches live allocation and reservation counts. Run Repair Occupancy to resync dashboard and vacancy metrics.",
          mismatchCount,
          "repair_analytics",
          rowDetails(
            liveVacancy
              .filter((live) => {
                const hostelId = stringValue(live, "hostel_id")
                const snapshot = hostelId ? snapshotByHostel.get(hostelId) : null

                return (
                  !snapshot ||
                  numberValue(snapshot, "occupied_beds") !== numberValue(live, "occupied_beds") ||
                  numberValue(snapshot, "reserved_beds") !== numberValue(live, "reserved_beds") ||
                  numberValue(snapshot, "available_beds") !== numberValue(live, "available_beds")
                )
              })
              .slice(0, 20),
            {
              tableName: "hostel_capacity",
              anomalyType: "capacity_snapshot_mismatch",
              expectedState: "stored snapshot equals live hostel_vacancy_view",
              actualState: "stored occupied/reserved/available capacity differs from live vacancy",
              repairAction: "repair_analytics",
              recommendation: "Run analytics repair to refresh hostel capacity and room capacity snapshots from live occupancy views.",
            }
          )
        ),
      ]
    : []
}

async function detectInvalidDuesAnomalies(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyFinding[]> {
  const [residents, feeRecords, invoices] = await Promise.all([
    repository.list("residents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,status,is_active,user_id,checkout_on,onboarding_status,deleted_at",
      limit: 5000,
    }),
    repository.list("monthly_fee_records", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,resident_id,status,paid_amount,balance_amount,period_month",
      in: { status: ["pending", "overdue"] },
      deletedAtNull: true,
      limit: 5000,
    }),
    repository.list("invoices", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,resident_id,monthly_fee_record_id,status,paid_amount,balance_amount",
      in: { status: ["draft", "issued", "overdue"] },
      deletedAtNull: true,
      limit: 5000,
    }),
  ])
  const residentById = indexById(residents)
  const invalidFeeRecords = feeRecords.filter((feeRecord) => {
    const resident = residentById.get(stringValue(feeRecord, "resident_id") ?? "")

    if (!resident || numberValue(feeRecord, "paid_amount") > 0) {
      return false
    }

    return !isResidentEligibleForBilling({
      id: stringValue(resident, "id"),
      status: stringValue(resident, "status"),
      is_active: booleanValue(resident, "is_active"),
      user_id: stringValue(resident, "user_id"),
      checkout_on: stringValue(resident, "checkout_on"),
      onboarding_status: stringValue(resident, "onboarding_status"),
    })
  })
  const invalidFeeRecordIds = new Set(
    invalidFeeRecords
      .map((feeRecord) => stringValue(feeRecord, "id"))
      .filter((id): id is string => Boolean(id))
  )
  const invalidInvoices = invoices.filter((invoice) => {
    const feeRecordId = stringValue(invoice, "monthly_fee_record_id")

    return Boolean(
      feeRecordId &&
        invalidFeeRecordIds.has(feeRecordId) &&
        numberValue(invoice, "paid_amount") === 0
    )
  })

  return invalidFeeRecords.length > 0 || invalidInvoices.length > 0
    ? [
        finding(
          "dues.inactive_resident_open_balances",
          "payment",
          "high",
          "Inactive residents have open dues",
          "Suspended, left, archived, rejected, or unlinked residents must not carry unpaid operational dues unless finance explicitly keeps them open.",
          invalidFeeRecords.length + invalidInvoices.length,
          "reconcile_dues",
          [
            ...rowDetails(invalidFeeRecords, {
              tableName: "monthly_fee_records",
              anomalyType: "inactive_resident_fee_record",
              expectedState: "pending/overdue dues only belong to billable, portal-linked residents",
              actualState: "open unpaid dues linked to a non-billable resident",
              repairAction: "reconcile_dues",
              recommendation: "Run dues reconciliation to cancel unpaid invalid fee records and linked unpaid invoices.",
            }),
            ...rowDetails(invalidInvoices, {
              tableName: "invoices",
              anomalyType: "inactive_resident_invoice",
              expectedState: "unpaid invoice belongs to valid operational fee record",
              actualState: "unpaid invoice linked to invalid inactive-resident fee record",
              repairAction: "reconcile_dues",
              recommendation: "Run dues reconciliation to cancel unpaid invoices linked to invalid inactive-resident dues.",
            }),
          ].slice(0, 20)
        ),
      ]
    : []
}

async function detectResidentAllocationAnomalies(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyFinding[]> {
  const [residents, activeAllocations] = await Promise.all([
    repository.list("residents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,status,is_active,user_id,checkout_on,onboarding_status,deleted_at",
      deletedAtNull: true,
      limit: 5000,
    }),
    repository.list("room_allocations", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,resident_id,room_id,status",
      equals: { status: "active" },
      deletedAtNull: true,
      limit: 5000,
    }),
  ])
  const operationalResidents = residents.filter((resident) =>
    isResidentEligibleForOccupancy({
      id: typeof resident.id === "string" ? resident.id : null,
      status: typeof resident.status === "string" ? resident.status : null,
      is_active: typeof resident.is_active === "boolean" ? resident.is_active : null,
      user_id: typeof resident.user_id === "string" ? resident.user_id : null,
      checkout_on: typeof resident.checkout_on === "string" ? resident.checkout_on : null,
      onboarding_status:
        typeof resident.onboarding_status === "string"
          ? resident.onboarding_status
          : null,
    })
  )
  const allocatedResidentIds = new Set(
    activeAllocations
      .map((allocation) => allocation.resident_id)
      .filter((residentId): residentId is string => typeof residentId === "string")
  )
  const allocationCountByResident = new Map<string, number>()

  activeAllocations.forEach((allocation) => {
    if (typeof allocation.resident_id === "string") {
      allocationCountByResident.set(
        allocation.resident_id,
        (allocationCountByResident.get(allocation.resident_id) ?? 0) + 1
      )
    }
  })

  const activeResidentIds = new Set(
    operationalResidents
      .map((resident) => resident.id)
      .filter((residentId): residentId is string => typeof residentId === "string")
  )
  const activeWithoutAllocation = operationalResidents.filter(
    (resident) => typeof resident.id === "string" && !allocatedResidentIds.has(resident.id)
  ).length
  const allocationWithoutActiveResident = activeAllocations.filter(
    (allocation) =>
      typeof allocation.resident_id === "string" &&
      !activeResidentIds.has(allocation.resident_id)
  ).length
  const residentsWithMultipleActiveAllocations = [...allocationCountByResident.values()].filter(
    (count) => count > 1
  ).length
  const findings: ConsistencyFinding[] = []

  if (activeWithoutAllocation > 0) {
    const rows = operationalResidents.filter(
      (resident) => typeof resident.id === "string" && !allocatedResidentIds.has(resident.id)
    )

    findings.push(
      finding(
        "residents.active_without_allocation",
        "occupancy",
        "high",
        "Active residents are missing room allocations",
        "Active residents without active allocations will not reduce vacancy and should be assigned or moved back to draft.",
        activeWithoutAllocation,
        "recalculate_occupancy",
        rowDetails(rows, {
          tableName: "residents",
          anomalyType: "active_resident_without_allocation",
          expectedState: "verified active resident has one active room allocation",
          actualState: "operational resident has no active room allocation",
          repairAction: "review_manually",
          recommendation: "Allocate a room or move the resident back to onboarding before billing and vacancy reporting.",
        })
      )
    )
  }

  if (allocationWithoutActiveResident > 0) {
    const rows = activeAllocations.filter(
      (allocation) =>
        typeof allocation.resident_id === "string" &&
        !activeResidentIds.has(allocation.resident_id)
    )

    findings.push(
      finding(
        "allocations.without_active_resident",
        "occupancy",
        "critical",
        "Active allocations are not linked to active residents",
        "Allocations for archived, suspended, or missing residents can inflate occupancy unless reconciled.",
        allocationWithoutActiveResident,
        "release_stale_allocations",
        rowDetails(rows, {
          tableName: "room_allocations",
          anomalyType: "allocation_without_operational_resident",
          expectedState: "active allocation belongs to verified active linked resident",
          actualState: "active allocation belongs to inactive, missing, or unverified resident",
          repairAction: "release_stale_allocations",
          recommendation: "Run occupancy repair to close invalid allocations and recalculate vacancy.",
        })
      )
    )
  }

  if (residentsWithMultipleActiveAllocations > 0) {
    const rows = activeAllocations.filter((allocation) => {
      const residentId = stringValue(allocation, "resident_id")

      return Boolean(residentId && (allocationCountByResident.get(residentId) ?? 0) > 1)
    })

    findings.push(
      finding(
        "allocations.multiple_active_for_resident",
        "occupancy",
        "critical",
        "Residents have multiple active room allocations",
        "A resident must occupy at most one active room. Use Repair Occupancy before running billing or vacancy reports.",
        residentsWithMultipleActiveAllocations,
        "release_stale_allocations",
        rowDetails(rows, {
          tableName: "room_allocations",
          anomalyType: "duplicate_active_allocation_for_resident",
          expectedState: "resident has at most one active allocation",
          actualState: "resident has multiple active allocations",
          repairAction: "release_stale_allocations",
          recommendation: "Run occupancy repair to keep the newest allocation and complete stale duplicates.",
        })
      )
    )
  }

  return findings
}

async function detectBusinessTenantLinkageAnomalies(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyFinding[]> {
  const [
    residents,
    payments,
    monthlyFeeRecords,
    invoices,
    allocations,
    rooms,
    invites,
    leads,
    reservations,
    reservationPayments,
    documents,
    users,
  ] = await Promise.all([
    repository.list("residents", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,user_id,status,is_active,deleted_at",
      limit: 8000,
    }),
    repository.list("payments", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,resident_id,monthly_fee_record_id,invoice_id,status",
      deletedAtNull: true,
      limit: 8000,
    }),
    repository.list("monthly_fee_records", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,resident_id,room_allocation_id,status",
      deletedAtNull: true,
      limit: 8000,
    }),
    repository.list("invoices", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,resident_id,monthly_fee_record_id,pdf_document_id,status",
      deletedAtNull: true,
      limit: 8000,
    }),
    repository.list("room_allocations", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,resident_id,room_id,status",
      deletedAtNull: true,
      limit: 8000,
    }),
    repository.list("rooms", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,status",
      limit: 5000,
    }),
    repository.list("resident_invites", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,resident_id,status",
      limit: 8000,
    }),
    repository.list("leads", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,joined_resident_id,status",
      limit: 8000,
    }),
    repository.list("reservations", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,lead_id,reserved_room_id,converted_resident_id,status",
      deletedAtNull: true,
      limit: 8000,
    }),
    repository.list("reservation_payments", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,reservation_id,lead_id,proof_document_id,invoice_id,status",
      deletedAtNull: true,
      limit: 8000,
    }),
    repository.list("documents", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,resident_id,payment_id,invoice_id,document_type,bucket_name,storage_path,is_public",
      deletedAtNull: true,
      limit: 8000,
    }),
    repository.list("users", {
      organizationId: input.organizationId,
      select: "id,organization_id,is_active,deleted_at",
      limit: 8000,
    }),
  ])
  const residentById = indexById(residents)
  const paymentById = indexById(payments)
  const feeById = indexById(monthlyFeeRecords)
  const invoiceById = indexById(invoices)
  const allocationById = indexById(allocations)
  const roomById = indexById(rooms)
  const leadById = indexById(leads)
  const reservationById = indexById(reservations)
  const documentById = indexById(documents)
  const userById = indexById(users)
  const details: ConsistencyFindingDetail[] = []

  residents.forEach((resident) => {
    const userId = stringValue(resident, "user_id")

    if (
      !userId ||
      stringValue(resident, "deleted_at") ||
      stringValue(resident, "status") === "archived"
    ) {
      return
    }

    const user = userById.get(userId)

    pushLinkageDetail(details, input, {
      tableName: "residents",
      record: resident,
      parent: user,
      relation: "auth user profile",
      anomalyType: "resident_user_tenant_mismatch",
      recommendation: "Resident onboarding/auth ownership is inconsistent. Manually review activation history before relinking the account.",
      compareHostel: false,
    })
  })

  allocations.forEach((allocation) => {
    const resident = residentById.get(stringValue(allocation, "resident_id") ?? "")
    const room = roomById.get(stringValue(allocation, "room_id") ?? "")

    pushLinkageDetail(details, input, {
      tableName: "room_allocations",
      record: allocation,
      parent: resident,
      relation: "resident",
      anomalyType: "allocation_resident_tenant_mismatch",
      recommendation: "Repair Occupancy/Tenant Linkage can close or rescope allocations when resident and room agree. Cross-hostel resident-room conflicts need manual transfer review.",
    })
    pushLinkageDetail(details, input, {
      tableName: "room_allocations",
      record: allocation,
      parent: room,
      relation: "room",
      anomalyType: "allocation_room_tenant_mismatch",
      recommendation: "Repair Occupancy/Tenant Linkage can rescope allocations when the room and resident belong to the same hostel. Otherwise choose the correct room manually.",
    })
  })

  monthlyFeeRecords.forEach((feeRecord) => {
    const resident = residentById.get(stringValue(feeRecord, "resident_id") ?? "")
    const allocation = allocationById.get(stringValue(feeRecord, "room_allocation_id") ?? "")

    pushLinkageDetail(details, input, {
      tableName: "monthly_fee_records",
      record: feeRecord,
      parent: resident,
      relation: "resident",
      anomalyType: "fee_record_resident_tenant_mismatch",
      recommendation: "Safe repair can rescope fee records to the resident tenant when linked allocation data agrees.",
    })

    if (stringValue(feeRecord, "room_allocation_id")) {
      pushLinkageDetail(details, input, {
        tableName: "monthly_fee_records",
        record: feeRecord,
        parent: allocation,
        relation: "room allocation",
        anomalyType: "fee_record_allocation_tenant_mismatch",
        recommendation: "Review fee generation history if the allocation belongs to another resident or hostel.",
      })
    }
  })

  invoices.forEach((invoice) => {
    const resident = residentById.get(stringValue(invoice, "resident_id") ?? "")
    const feeRecord = feeById.get(stringValue(invoice, "monthly_fee_record_id") ?? "")
    const pdfDocument = documentById.get(stringValue(invoice, "pdf_document_id") ?? "")

    pushLinkageDetail(details, input, {
      tableName: "invoices",
      record: invoice,
      parent: resident,
      relation: "resident",
      anomalyType: "invoice_resident_tenant_mismatch",
      recommendation: "Safe repair can rescope draft/issued invoice records to the resident tenant when fee records agree.",
    })

    if (stringValue(invoice, "monthly_fee_record_id")) {
      pushLinkageDetail(details, input, {
        tableName: "invoices",
        record: invoice,
        parent: feeRecord,
        relation: "monthly fee record",
        anomalyType: "invoice_fee_record_tenant_mismatch",
        recommendation: "Reconcile invoice and fee record before resident download or finance export.",
      })
    }

    if (stringValue(invoice, "pdf_document_id")) {
      pushLinkageDetail(details, input, {
        tableName: "invoices",
        record: invoice,
        parent: pdfDocument,
        relation: "PDF document",
        anomalyType: "invoice_pdf_document_tenant_mismatch",
        recommendation: "Regenerate invoice PDF if the linked document belongs to a different tenant scope.",
      })
    }
  })

  payments.forEach((payment) => {
    const resident = residentById.get(stringValue(payment, "resident_id") ?? "")
    const feeRecord = feeById.get(stringValue(payment, "monthly_fee_record_id") ?? "")
    const invoice = invoiceById.get(stringValue(payment, "invoice_id") ?? "")

    pushLinkageDetail(details, input, {
      tableName: "payments",
      record: payment,
      parent: resident,
      relation: "resident",
      anomalyType: "payment_resident_tenant_mismatch",
      recommendation: "Safe repair can rescope pending/manual payments to the resident tenant when invoice and fee links agree.",
    })

    if (stringValue(payment, "monthly_fee_record_id")) {
      pushLinkageDetail(details, input, {
        tableName: "payments",
        record: payment,
        parent: feeRecord,
        relation: "monthly fee record",
        anomalyType: "payment_fee_record_tenant_mismatch",
        recommendation: "Recalculate ledger after repairing payment-to-fee linkage.",
      })
    }

    if (stringValue(payment, "invoice_id")) {
      pushLinkageDetail(details, input, {
        tableName: "payments",
        record: payment,
        parent: invoice,
        relation: "invoice",
        anomalyType: "payment_invoice_tenant_mismatch",
        recommendation: "Reconcile invoice/payment linkage before approving or exporting finance reports.",
      })
    }
  })

  invites.forEach((invite) => {
    const resident = residentById.get(stringValue(invite, "resident_id") ?? "")

    pushLinkageDetail(details, input, {
      tableName: "resident_invites",
      record: invite,
      parent: resident,
      relation: "resident",
      anomalyType: "invite_resident_tenant_mismatch",
      recommendation: "Safe repair can rescope unused invites to the resident tenant. Revoke and resend if the invite was already shared.",
    })
  })

  reservations.forEach((reservation) => {
    const lead = leadById.get(stringValue(reservation, "lead_id") ?? "")
    const room = roomById.get(stringValue(reservation, "reserved_room_id") ?? "")
    const convertedResident = residentById.get(stringValue(reservation, "converted_resident_id") ?? "")

    pushLinkageDetail(details, input, {
      tableName: "reservations",
      record: reservation,
      parent: lead,
      relation: "lead",
      anomalyType: "reservation_lead_tenant_mismatch",
      recommendation: "Safe repair can rescope reservations to the lead tenant when the reserved room agrees.",
    })

    if (stringValue(reservation, "reserved_room_id")) {
      pushLinkageDetail(details, input, {
        tableName: "reservations",
        record: reservation,
        parent: room,
        relation: "reserved room",
        anomalyType: "reservation_room_tenant_mismatch",
        recommendation: "Move or cancel the reservation manually if the room belongs to a different hostel.",
      })
    }

    if (stringValue(reservation, "converted_resident_id")) {
      pushLinkageDetail(details, input, {
        tableName: "reservations",
        record: reservation,
        parent: convertedResident,
        relation: "converted resident",
        anomalyType: "reservation_converted_resident_tenant_mismatch",
        recommendation: "Review conversion history before editing converted reservations.",
      })
    }
  })

  reservationPayments.forEach((reservationPayment) => {
    const reservation = reservationById.get(stringValue(reservationPayment, "reservation_id") ?? "")
    const lead = leadById.get(stringValue(reservationPayment, "lead_id") ?? "")
    const proofDocument = documentById.get(stringValue(reservationPayment, "proof_document_id") ?? "")
    const invoice = invoiceById.get(stringValue(reservationPayment, "invoice_id") ?? "")

    pushLinkageDetail(details, input, {
      tableName: "reservation_payments",
      record: reservationPayment,
      parent: reservation,
      relation: "reservation",
      anomalyType: "reservation_payment_reservation_tenant_mismatch",
      recommendation: "Safe repair can rescope advance payments to the reservation tenant when lead/proof links agree.",
    })

    pushLinkageDetail(details, input, {
      tableName: "reservation_payments",
      record: reservationPayment,
      parent: lead,
      relation: "lead",
      anomalyType: "reservation_payment_lead_tenant_mismatch",
      recommendation: "Review advance payment if the lead linkage is missing or belongs to another hostel.",
    })

    if (stringValue(reservationPayment, "proof_document_id")) {
      pushLinkageDetail(details, input, {
        tableName: "reservation_payments",
        record: reservationPayment,
        parent: proofDocument,
        relation: "proof document",
        anomalyType: "reservation_payment_proof_tenant_mismatch",
        recommendation: "Regenerate the signed preview only after proof ownership is repaired.",
      })
    }

    if (stringValue(reservationPayment, "invoice_id")) {
      pushLinkageDetail(details, input, {
        tableName: "reservation_payments",
        record: reservationPayment,
        parent: invoice,
        relation: "invoice",
        anomalyType: "reservation_payment_invoice_tenant_mismatch",
        recommendation: "Reconcile reservation advance invoice before confirming the reservation.",
      })
    }
  })

  documents.forEach((document) => {
    const resident = residentById.get(stringValue(document, "resident_id") ?? "")
    const payment = paymentById.get(stringValue(document, "payment_id") ?? "")
    const invoice = invoiceById.get(stringValue(document, "invoice_id") ?? "")

    if (stringValue(document, "resident_id")) {
      pushLinkageDetail(details, input, {
        tableName: "documents",
        record: document,
        parent: resident,
        relation: "resident",
        anomalyType: "document_resident_tenant_mismatch",
        recommendation: "Safe repair can rescope document metadata when payment/invoice links agree. Storage path changes remain manual.",
      })
    }

    if (stringValue(document, "payment_id")) {
      pushLinkageDetail(details, input, {
        tableName: "documents",
        record: document,
        parent: payment,
        relation: "payment",
        anomalyType: "document_payment_tenant_mismatch",
        recommendation: "Block signed URL preview until payment proof metadata is tenant-safe.",
      })
    }

    if (stringValue(document, "invoice_id")) {
      pushLinkageDetail(details, input, {
        tableName: "documents",
        record: document,
        parent: invoice,
        relation: "invoice",
        anomalyType: "document_invoice_tenant_mismatch",
        recommendation: "Regenerate invoice PDFs if document tenant metadata cannot be safely repaired.",
      })
    }
  })

  const scopedDetails = details.filter((detail) => isDetailInScope(detail, input.hostelId))
  const safeRepairCount = scopedDetails.filter(isSameOrganizationHostelMismatch).length
  const manualCount = scopedDetails.length - safeRepairCount

  return scopedDetails.length > 0
    ? [
        finding(
          "security.business_tenant_scope",
          "security",
          "critical",
          "Business records have tenant linkage anomalies",
          [
            `${scopedDetails.length} tenant linkage issue(s) found across operational records.`,
            `${safeRepairCount} same-organization hostel mismatch(es) can be repaired automatically.`,
            `${manualCount} orphan, missing parent, or cross-organization issue(s) require manual review.`,
          ].join(" "),
          scopedDetails.length,
          safeRepairCount > 0 ? "repair_tenant_linkage" : "review_manually",
          scopedDetails.slice(0, 20)
        ),
      ]
    : []
}

async function detectSecurityAnomalies(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyFinding[]> {
  const [
    documents,
    payments,
    residents,
    roles,
    users,
  ] = await Promise.all([
    repository.list("documents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select:
        "id,organization_id,hostel_id,resident_id,payment_id,invoice_id,document_type,bucket_name,storage_path,is_public",
      deletedAtNull: true,
      limit: 5000,
    }),
    repository.list("payments", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,resident_id,monthly_fee_record_id,invoice_id,status",
      deletedAtNull: true,
      limit: 5000,
    }),
    repository.list("residents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,user_id,status,is_active",
      deletedAtNull: true,
      limit: 5000,
    }),
    repository.list("user_roles", {
      organizationId: input.organizationId,
      select: "id,organization_id,hostel_id,user_id,role,status",
      deletedAtNull: true,
      limit: 5000,
    }),
    repository.list("users", {
      organizationId: input.organizationId,
      select: "id,organization_id,is_active,deleted_at",
      deletedAtNull: true,
      limit: 5000,
    }),
  ])
  const findings: ConsistencyFinding[] = []
  const residentById = indexById(residents)
  const paymentById = indexById(payments)
  const userById = indexById(users)
  const unsafePublicDocumentRows = documents.filter(
    (document) =>
      stringValue(document, "bucket_name") !== "gallery-images" &&
      booleanValue(document, "is_public") === true
  )
  const pathScopeMismatchRows = documents.filter((document) => {
    const storagePath = stringValue(document, "storage_path")

    return Boolean(storagePath && !storagePath.startsWith(`${input.organizationId}/`))
  })
  const orphanDocumentRows = documents.filter((document) => {
    const residentId = stringValue(document, "resident_id")
    const paymentId = stringValue(document, "payment_id")
    const residentMissing = Boolean(residentId && !residentById.has(residentId))
    const paymentMissing = Boolean(paymentId && !paymentById.has(paymentId))

    return residentMissing || paymentMissing
  })
  const paymentProofScopeMismatchRows = documents.filter((document) => {
    if (stringValue(document, "document_type") !== "payment_receipt") {
      return false
    }

    const paymentId = stringValue(document, "payment_id")
    const residentId = stringValue(document, "resident_id")
    const payment = paymentId ? paymentById.get(paymentId) : null

    return (
      stringValue(document, "bucket_name") !== "payment-screenshots" ||
      !paymentId ||
      !residentId ||
      !payment ||
      stringValue(payment, "resident_id") !== residentId
    )
  })
  const activeRoleWithoutUserRows = roles.filter((role) => {
    if (stringValue(role, "status") !== "active") {
      return false
    }

    const user = userById.get(stringValue(role, "user_id") ?? "")

    return !user || booleanValue(user, "is_active") === false
  })
  const roleTenantMismatchRows = roles.filter((role) => {
    const user = userById.get(stringValue(role, "user_id") ?? "")
    const userOrganizationId = user ? stringValue(user, "organization_id") : null

    return Boolean(
      userOrganizationId &&
        userOrganizationId !== stringValue(role, "organization_id")
    )
  })
  const unsafePublicDocuments = unsafePublicDocumentRows.length
  const pathScopeMismatches = pathScopeMismatchRows.length
  const orphanDocuments = orphanDocumentRows.length
  const paymentProofScopeMismatches = paymentProofScopeMismatchRows.length
  const activeRolesWithoutUsers = activeRoleWithoutUserRows.length
  const roleTenantMismatches = roleTenantMismatchRows.length

  if (unsafePublicDocuments > 0 || pathScopeMismatches > 0) {
    findings.push(
      finding(
        "security.upload_scope",
        "security",
        "critical",
        "Upload tenant scope needs security review",
        "Private documents must not be public, and all storage paths must start with the organization ID.",
        unsafePublicDocuments + pathScopeMismatches,
        "review_manually",
        [
          ...rowDetails(unsafePublicDocumentRows, {
            tableName: "documents",
            anomalyType: "private_document_marked_public",
            expectedState: "private document is_public false",
            actualState: "private document is_public true",
            repairAction: "review_manually",
            recommendation: "Mark private document metadata non-public and regenerate signed access only after ownership is verified.",
          }),
          ...rowDetails(pathScopeMismatchRows, {
            tableName: "documents",
            anomalyType: "storage_path_missing_organization_scope",
            expectedState: `storage_path starts with ${input.organizationId}/`,
            actualState: "storage_path is outside organization prefix",
            repairAction: "review_manually",
            recommendation: "Move or regenerate the uploaded file under the organization-scoped storage prefix.",
          }),
        ].slice(0, 20)
      )
    )
  }

  if (orphanDocuments > 0 || paymentProofScopeMismatches > 0) {
    findings.push(
      finding(
        "security.upload_ownership",
        "security",
        "critical",
        "Upload ownership anomalies detected",
        "Document metadata references missing or mismatched residents/payments. Signed URL access should be blocked until repaired.",
        orphanDocuments + paymentProofScopeMismatches,
        "review_manually",
        [
          ...rowDetails(orphanDocumentRows, {
            tableName: "documents",
            anomalyType: "orphan_document_reference",
            expectedState: "document links to existing resident/payment in same tenant",
            actualState: "document resident/payment reference is missing or inaccessible",
            repairAction: "review_manually",
            recommendation: "Repair document metadata or archive the orphan upload before issuing signed URLs.",
          }),
          ...rowDetails(paymentProofScopeMismatchRows, {
            tableName: "documents",
            anomalyType: "payment_proof_ownership_mismatch",
            expectedState: "payment proof bucket/path belongs to linked resident payment",
            actualState: "payment proof metadata does not match linked payment owner",
            repairAction: "review_manually",
            recommendation: "Block preview and re-upload the proof under the correct resident/payment path.",
          }),
        ].slice(0, 20)
      )
    )
  }

  if (activeRolesWithoutUsers > 0 || roleTenantMismatches > 0) {
    findings.push(
      finding(
        "security.role_scope",
        "security",
        "critical",
        "Role assignments need access review",
        "Active role assignments must point to active users in the same organization to prevent stale or cross-tenant access.",
        activeRolesWithoutUsers + roleTenantMismatches,
        "review_manually",
        [
          ...rowDetails(activeRoleWithoutUserRows, {
            tableName: "user_roles",
            anomalyType: "active_role_without_active_user",
            expectedState: "active role belongs to active user",
            actualState: "active role references missing/inactive user",
            repairAction: "review_manually",
            recommendation: "Suspend or revoke the stale role assignment from Staff & Access.",
          }),
          ...rowDetails(roleTenantMismatchRows, {
            tableName: "user_roles",
            anomalyType: "role_user_tenant_mismatch",
            expectedState: "role organization matches user organization",
            actualState: "role organization differs from user organization",
            repairAction: "review_manually",
            recommendation: "Revoke the role and recreate access in the correct organization.",
          }),
        ].slice(0, 20)
      )
    )
  }

  return findings
}

function buildReport(input: {
  organizationId: string
  hostelId?: string | null
  findings: ConsistencyFinding[]
}): ConsistencyReport {
  const summaries = {
    critical: countSeverity(input.findings, "critical"),
    high: countSeverity(input.findings, "high"),
    medium: countSeverity(input.findings, "medium"),
    low: countSeverity(input.findings, "low"),
    informational: countSeverity(input.findings, "informational"),
    totalFindings: input.findings.length,
  }
  const score = Math.max(
    0,
    100 -
      summaries.critical * 25 -
      summaries.high * 15 -
      summaries.medium * 8 -
      summaries.low * 3 -
      summaries.informational
  )

  return {
    organizationId: input.organizationId,
    hostelId: input.hostelId,
    generatedAt: new Date().toISOString(),
    score,
    findings: input.findings,
    summaries,
  }
}

function countSeverity(findings: ConsistencyFinding[], severity: ConsistencySeverity) {
  return findings.filter((finding) => finding.severity === severity).length
}

function finding(
  id: ConsistencyFinding["id"],
  category: ConsistencyFinding["category"],
  severity: ConsistencySeverity,
  title: string,
  description: string,
  count: number,
  repairAction: ConsistencyFinding["repairAction"],
  details?: ConsistencyFindingDetail[]
): ConsistencyFinding {
  return {
    id,
    category,
    severity,
    title,
    description,
    count,
    repairAction,
    ...(details && details.length > 0 ? { details } : {}),
  }
}

function pushLinkageDetail(
  details: ConsistencyFindingDetail[],
  _input: ScannerInput,
  values: {
    tableName: string
    record: Record<string, unknown>
    parent?: Record<string, unknown> | null
    relation: string
    anomalyType: string
    recommendation: string
    compareHostel?: boolean
  }
) {
  const recordId = stringValue(values.record, "id")
  const actualOrganizationId = stringValue(values.record, "organization_id")
  const actualHostelId = stringValue(values.record, "hostel_id")
  const compareHostel = values.compareHostel ?? true
  const expectedOrganizationId = values.parent
    ? stringValue(values.parent, "organization_id")
    : null
  const expectedHostelId = values.parent
    ? stringValue(values.parent, "hostel_id")
    : null

  if (
    values.parent &&
    actualOrganizationId === expectedOrganizationId &&
    (!compareHostel || actualHostelId === expectedHostelId)
  ) {
    return
  }

  details.push({
    tableName: values.tableName,
    recordId,
    residentId: stringValue(values.record, "resident_id"),
    organizationId: actualOrganizationId,
    hostelId: actualHostelId,
    anomalyType: values.parent
      ? values.anomalyType
      : `${values.anomalyType}_orphan_${values.relation.replace(/\s+/g, "_")}`,
    expectedState: values.parent
      ? `record tenant matches linked ${values.relation}`
      : `linked ${values.relation} exists in tenant scope`,
    actualState: values.parent
      ? "record tenant differs from linked record"
      : `linked ${values.relation} is missing or outside tenant scope`,
    expectedOrganizationId,
    actualOrganizationId,
    expectedHostelId: compareHostel ? expectedHostelId : actualHostelId,
    actualHostelId,
    recommendedRepairAction: "repair_tenant_linkage",
    recommendation: values.parent
      ? values.recommendation
      : `Linked ${values.relation} is missing or outside the visible tenant scope. Review this record manually before repair.`,
  })
}

function rowDetails(
  rows: Array<Record<string, unknown>>,
  values: {
    tableName: string
    anomalyType: string
    expectedState: string
    actualState: string
    repairAction: ConsistencyRepairAction
    recommendation: string
  }
): ConsistencyFindingDetail[] {
  return rows.slice(0, 20).map((row) => {
    const organizationId = stringValue(row, "organization_id")
    const hostelId = stringValue(row, "hostel_id")

    return {
      tableName: values.tableName,
      recordId: stringValue(row, "id"),
      residentId: stringValue(row, "resident_id") ?? stringValue(row, "id"),
      organizationId,
      hostelId,
      anomalyType: values.anomalyType,
      expectedState: values.expectedState,
      actualState: values.actualState,
      expectedOrganizationId: organizationId,
      actualOrganizationId: organizationId,
      expectedHostelId: hostelId,
      actualHostelId: hostelId,
      recommendedRepairAction: values.repairAction,
      recommendation: values.recommendation,
    }
  })
}

function duplicateIdentityDetails(
  counts: Map<string, number>,
  identityType: string
): ConsistencyFindingDetail[] {
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .slice(0, 20)
    .map(([identity, count]) => ({
      tableName: "residents",
      recordId: null,
      residentId: null,
      organizationId: null,
      hostelId: null,
      anomalyType: `duplicate_${identityType}`,
      expectedState: `unique ${identityType} among production residents`,
      actualState: `${count} production residents share ${identityType} ${identity}`,
      expectedOrganizationId: null,
      actualOrganizationId: null,
      expectedHostelId: null,
      actualHostelId: null,
      recommendedRepairAction: "review_manually",
      recommendation: "Review duplicate resident identities and merge, archive, or correct the duplicate records.",
    }))
}

function isDetailInScope(detail: ConsistencyFindingDetail, hostelId?: string | null) {
  return (
    !hostelId ||
    detail.actualHostelId === hostelId ||
    detail.expectedHostelId === hostelId
  )
}

function isSameOrganizationHostelMismatch(detail: ConsistencyFindingDetail) {
  return Boolean(
    detail.actualOrganizationId &&
      detail.expectedOrganizationId &&
      detail.actualOrganizationId === detail.expectedOrganizationId &&
      detail.actualHostelId &&
      detail.expectedHostelId &&
      detail.actualHostelId !== detail.expectedHostelId
  )
}

function indexById(rows: Array<Record<string, unknown>>) {
  const index = new Map<string, Record<string, unknown>>()

  rows.forEach((row) => {
    const id = stringValue(row, "id")

    if (id) {
      index.set(id, row)
    }
  })

  return index
}

function stringValue(row: Record<string, unknown>, key: string) {
  const value = row[key]

  return typeof value === "string" ? value : null
}

function booleanValue(row: Record<string, unknown>, key: string) {
  const value = row[key]

  return typeof value === "boolean" ? value : null
}

function numberValue(row: Record<string, unknown>, key: string) {
  const value = row[key]

  return typeof value === "number" ? value : Number(value ?? 0)
}

function getRowIdentityMode(row: Record<string, unknown>) {
  return getResidentIdentityMode({
    email: stringValue(row, "email"),
    phone: stringValue(row, "phone"),
  })
}

function getExpectedAuthIdentityMode(
  resident: Record<string, unknown>,
  user?: Record<string, unknown> | null
): ResidentIdentityMode {
  const residentMode = metadataIdentityMode(recordFromUnknown(resident.metadata))

  if (residentMode) {
    return residentMode
  }

  const residentMetadata = recordFromUnknown(resident.metadata)

  if (
    residentMetadata.whatsapp_onboarding_ready === true &&
    stringValue(resident, "phone")
  ) {
    return "phone_only"
  }

  const userMetadata = recordFromUnknown(user?.metadata)

  if (
    userMetadata.phone_password_login_strategy === "internal_email_alias" &&
    stringValue(resident, "phone")
  ) {
    return "phone_only"
  }

  return getRowIdentityMode(resident)
}

function authMetadataIdentityMode(row?: Record<string, unknown> | null): ResidentIdentityMode | null {
  return metadataIdentityMode(recordFromUnknown(row?.metadata))
}

function metadataIdentityMode(metadata: Record<string, unknown>): ResidentIdentityMode | null {
  const mode = metadata.resident_identity_mode

  if (mode === "phone" || mode === "phone_only") {
    return "phone_only"
  }

  if (mode === "email" || mode === "email_only") {
    return "email_only"
  }

  if (mode === "email_and_phone" || mode === "hybrid") {
    return "hybrid"
  }

  return null
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}
