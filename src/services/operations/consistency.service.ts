import "server-only"

import { ADMIN_PORTAL_ROLES, ADMIN_ROLES } from "@/constants/auth"
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
import { isResidentEligibleForOccupancy } from "@/services/analytics/operational-metrics"

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

    if (values.action === "repair_tenant_linkage") {
      if (!context.roles.some((role) => ADMIN_ROLES.some((adminRole) => adminRole === role))) {
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
  findings.push(...await detectCapacitySnapshotAnomalies(repository, input))
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

  return duplicateCount > 0
    ? [
        finding(
          "residents.duplicates",
          "orphan_data",
          "high",
          "Duplicate production resident identities detected",
          "Active, suspended, or portal-linked residents share phone, email, or name plus Aadhaar-last-4. Draft admissions are ignored until activation.",
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
          "recalculate_occupancy"
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
      select: "id,status,is_active,user_id,checkout_on,onboarding_status,deleted_at",
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

    if (!userId) {
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
  }
) {
  const recordId = stringValue(values.record, "id")
  const actualOrganizationId = stringValue(values.record, "organization_id")
  const actualHostelId = stringValue(values.record, "hostel_id")
  const expectedOrganizationId = values.parent
    ? stringValue(values.parent, "organization_id")
    : null
  const expectedHostelId = values.parent
    ? stringValue(values.parent, "hostel_id")
    : null

  if (
    values.parent &&
    actualOrganizationId === expectedOrganizationId &&
    actualHostelId === expectedHostelId
  ) {
    return
  }

  details.push({
    tableName: values.tableName,
    recordId,
    anomalyType: values.parent
      ? values.anomalyType
      : `${values.anomalyType}_orphan_${values.relation.replace(/\s+/g, "_")}`,
    expectedOrganizationId,
    actualOrganizationId,
    expectedHostelId,
    actualHostelId,
    recommendation: values.parent
      ? values.recommendation
      : `Linked ${values.relation} is missing or outside the visible tenant scope. Review this record manually before repair.`,
  })
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
