import "server-only"

import { ADMIN_PORTAL_ROLES } from "@/constants/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { OperationsRepository } from "@/repositories/operations.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type {
  ConsistencyFinding,
  ConsistencyReport,
  ConsistencySeverity,
} from "@/types/operations"
import {
  consistencyReportQuerySchema,
  consistencyRepairSchema,
} from "@/validations/operations.validation"

import { AuthService } from "../auth.service"

type ScannerInput = {
  organizationId: string
  hostelId?: string | null
  runId?: string | null
  actorUserId?: string | null
  persist?: boolean
}

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
    const context = await this.authService.requireRole(ADMIN_PORTAL_ROLES)
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
    const context = await this.authService.requireRole(ADMIN_PORTAL_ROLES)

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    if (values.dryRun) {
      return {
        repaired: 0,
        dryRun: true,
        message: "Dry run completed. No records were changed.",
      }
    }

    if (values.action === "recalculate_occupancy") {
      if (values.hostelId) {
        await this.repository.recalculateHostelCapacity({
          organizationId: values.organizationId,
          hostelId: values.hostelId,
        })
        return { repaired: 1, dryRun: false, message: "Capacity recalculated." }
      }

      return {
        repaired: 0,
        dryRun: false,
        message: "Choose a hostel before recalculating capacity.",
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
      equals: { status: "verified" },
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
    repository.count("room_allocations", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      equals: { status: "active" },
      lte: { allocated_to: now.toISOString().slice(0, 10) },
      deletedAtNull: true,
    }),
  ])

  if (staleReservations > 0) {
    findings.push(
      finding(
        "reservations.expired_pending",
        "reservation",
        "high",
        "Expired reservations still hold beds",
        "Reservations past reserved_until can block public vacancy and overstate reserved beds.",
        staleReservations,
        "expire_reservations"
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
        "expire_invites"
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
        "cleanup_uploads"
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
        "review_manually"
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
        "review_manually"
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
        "review_manually"
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
        "Active allocations with past end dates can inflate occupied beds and dues generation.",
        activeAllocationsPastEndDate,
        "recalculate_occupancy"
      )
    )
  }

  findings.push(...await detectDuplicateResidents(repository, input))
  findings.push(...await detectResidentAllocationAnomalies(repository, input))
  findings.push(...await detectOverCapacityRooms(repository, input))
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
    select: "id,phone,aadhaar_last4,full_name",
    deletedAtNull: true,
    limit: 2000,
  })
  const phones = new Map<string, number>()
  const aadhaarIdentity = new Map<string, number>()

  residents.forEach((resident) => {
    if (typeof resident.phone === "string" && resident.phone.trim()) {
      phones.set(resident.phone, (phones.get(resident.phone) ?? 0) + 1)
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
    [...aadhaarIdentity.values()].filter((count) => count > 1).length

  return duplicateCount > 0
    ? [
        finding(
          "residents.duplicates",
          "orphan_data",
          "high",
          "Duplicate resident identities detected",
          "Duplicate phone or name plus Aadhaar-last-4 matches should be reviewed before billing or onboarding.",
          duplicateCount,
          "review_manually"
        ),
      ]
    : []
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

  const overCapacityCount = [...activeByRoom.entries()].filter(
    ([roomId, activeCount]) => activeCount > (capacityByRoom.get(roomId) ?? 0)
  ).length

  return overCapacityCount > 0
    ? [
        finding(
          "rooms.over_capacity",
          "occupancy",
          "critical",
          "Rooms exceed configured capacity",
          "Active allocations exceed room capacity. Run occupancy recalculation and manually inspect affected rooms.",
          overCapacityCount,
          "recalculate_occupancy"
        ),
      ]
    : []
}

async function detectResidentAllocationAnomalies(
  repository: OperationsRepository,
  input: ScannerInput
): Promise<ConsistencyFinding[]> {
  const [activeResidents, activeAllocations] = await Promise.all([
    repository.list("residents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,status,is_active,deleted_at",
      equals: { status: "active", is_active: true },
      deletedAtNull: true,
      limit: 5000,
    }),
    repository.list("room_allocations", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,resident_id,status",
      equals: { status: "active" },
      deletedAtNull: true,
      limit: 5000,
    }),
  ])
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
    activeResidents
      .map((resident) => resident.id)
      .filter((residentId): residentId is string => typeof residentId === "string")
  )
  const activeWithoutAllocation = activeResidents.filter(
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
    findings.push(
      finding(
        "residents.active_without_allocation",
        "occupancy",
        "high",
        "Active residents are missing room allocations",
        "Active residents without active allocations will not reduce vacancy and should be assigned or moved back to draft.",
        activeWithoutAllocation,
        "recalculate_occupancy"
      )
    )
  }

  if (allocationWithoutActiveResident > 0) {
    findings.push(
      finding(
        "allocations.without_active_resident",
        "occupancy",
        "critical",
        "Active allocations are not linked to active residents",
        "Allocations for archived, suspended, or missing residents can inflate occupancy unless reconciled.",
        allocationWithoutActiveResident,
        "recalculate_occupancy"
      )
    )
  }

  if (residentsWithMultipleActiveAllocations > 0) {
    findings.push(
      finding(
        "allocations.multiple_active_for_resident",
        "occupancy",
        "critical",
        "Residents have multiple active room allocations",
        "A resident must occupy at most one active room. Use Repair Occupancy before running billing or vacancy reports.",
        residentsWithMultipleActiveAllocations,
        "recalculate_occupancy"
      )
    )
  }

  return findings
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
    invites,
    reservations,
    reservationPayments,
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
    repository.list("resident_invites", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,resident_id,status,used_at,revoked_at",
      limit: 5000,
    }),
    repository.list("reservations", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,lead_id,status",
      deletedAtNull: true,
      limit: 5000,
    }),
    repository.list("reservation_payments", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id,organization_id,hostel_id,reservation_id,lead_id,status,proof_document_id",
      deletedAtNull: true,
      limit: 5000,
    }),
  ])
  const findings: ConsistencyFinding[] = []
  const residentById = indexById(residents)
  const paymentById = indexById(payments)
  const userById = indexById(users)
  const reservationById = indexById(reservations)
  const unsafePublicDocuments = documents.filter(
    (document) =>
      stringValue(document, "bucket_name") !== "gallery-images" &&
      booleanValue(document, "is_public") === true
  ).length
  const pathScopeMismatches = documents.filter((document) => {
    const storagePath = stringValue(document, "storage_path")

    return Boolean(storagePath && !storagePath.startsWith(`${input.organizationId}/`))
  }).length
  const orphanDocuments = documents.filter((document) => {
    const residentId = stringValue(document, "resident_id")
    const paymentId = stringValue(document, "payment_id")
    const residentMissing = Boolean(residentId && !residentById.has(residentId))
    const paymentMissing = Boolean(paymentId && !paymentById.has(paymentId))

    return residentMissing || paymentMissing
  }).length
  const paymentProofScopeMismatches = documents.filter((document) => {
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
  }).length
  const activeRolesWithoutUsers = roles.filter((role) => {
    if (stringValue(role, "status") !== "active") {
      return false
    }

    const user = userById.get(stringValue(role, "user_id") ?? "")

    return !user || booleanValue(user, "is_active") === false
  }).length
  const roleTenantMismatches = roles.filter((role) => {
    const user = userById.get(stringValue(role, "user_id") ?? "")
    const userOrganizationId = user ? stringValue(user, "organization_id") : null

    return Boolean(
      userOrganizationId &&
        userOrganizationId !== stringValue(role, "organization_id")
    )
  }).length
  const paymentResidentMismatches = payments.filter((payment) => {
    const resident = residentById.get(stringValue(payment, "resident_id") ?? "")

    return (
      !resident ||
      stringValue(resident, "organization_id") !== stringValue(payment, "organization_id") ||
      stringValue(resident, "hostel_id") !== stringValue(payment, "hostel_id")
    )
  }).length
  const inviteResidentMismatches = invites.filter((invite) => {
    const resident = residentById.get(stringValue(invite, "resident_id") ?? "")

    return (
      !resident ||
      stringValue(resident, "organization_id") !== stringValue(invite, "organization_id") ||
      stringValue(resident, "hostel_id") !== stringValue(invite, "hostel_id")
    )
  }).length
  const reservationPaymentMismatches = reservationPayments.filter((reservationPayment) => {
    const reservation = reservationById.get(
      stringValue(reservationPayment, "reservation_id") ?? ""
    )

    return (
      !reservation ||
      stringValue(reservation, "organization_id") !==
        stringValue(reservationPayment, "organization_id") ||
      stringValue(reservation, "hostel_id") !==
        stringValue(reservationPayment, "hostel_id") ||
      stringValue(reservation, "lead_id") !== stringValue(reservationPayment, "lead_id")
    )
  }).length

  if (unsafePublicDocuments > 0 || pathScopeMismatches > 0) {
    findings.push(
      finding(
        "security.upload_scope",
        "security",
        "critical",
        "Upload tenant scope needs security review",
        "Private documents must not be public, and all storage paths must start with the organization ID.",
        unsafePublicDocuments + pathScopeMismatches,
        "review_manually"
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
        "review_manually"
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
        "review_manually"
      )
    )
  }

  if (
    paymentResidentMismatches > 0 ||
    inviteResidentMismatches > 0 ||
    reservationPaymentMismatches > 0
  ) {
    findings.push(
      finding(
        "security.business_tenant_scope",
        "security",
        "critical",
        "Business records have tenant linkage anomalies",
        "Payments, resident invites, and reservation payments must link only to records inside the same organization and hostel.",
        paymentResidentMismatches + inviteResidentMismatches + reservationPaymentMismatches,
        "review_manually"
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
    totalFindings: input.findings.length,
  }
  const score = Math.max(
    0,
    100 -
      summaries.critical * 25 -
      summaries.high * 15 -
      summaries.medium * 8 -
      summaries.low * 3
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
  repairAction: ConsistencyFinding["repairAction"]
): ConsistencyFinding {
  return {
    id,
    category,
    severity,
    title,
    description,
    count,
    repairAction,
  }
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
