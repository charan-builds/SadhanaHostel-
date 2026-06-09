import "server-only"

import {
  buildResidentLifecycleControlCenter,
} from "@/lib/residents/lifecycle-control-center"
import { calculateAdvanceBalance } from "@/lib/finance/advance-ledger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AdvanceLedgerRepository } from "@/repositories/advance-ledger.repository"
import { OperationsRepository } from "@/repositories/operations.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { residentLifecycleControlCenterSchema } from "@/validations/resident.validation"

import { AuthService } from "../auth.service"

export class LifecycleControlCenterService {
  private readonly authService: AuthService
  private readonly operationsRepository: OperationsRepository
  private readonly advanceRepository: AdvanceLedgerRepository

  constructor(
    private readonly db: AppSupabaseClient,
    adminDb: AppSupabaseClient = createSupabaseAdminClient()
  ) {
    this.authService = new AuthService(db)
    this.operationsRepository = new OperationsRepository(adminDb)
    this.advanceRepository = new AdvanceLedgerRepository(adminDb)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new LifecycleControlCenterService(db)
  }

  async getControlCenter(input: unknown) {
    const values = residentLifecycleControlCenterSchema.parse(input)
    const context = await this.authService.requirePermission("residents.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )
    const monthStart = values.month ? `${values.month}-01` : undefined
    const [residents, invites, feeRecords, leaves, rooms, advanceRows] = await Promise.all([
      this.operationsRepository.list("residents", {
        organizationId: values.organizationId,
        hostelId,
        select:
          "id,full_name,admission_number,phone,hostel_id,status,onboarding_status,is_active,user_id,joined_on,checkout_on",
        deletedAtNull: true,
        limit: 50_000,
      }),
      this.operationsRepository.list("resident_invites", {
        organizationId: values.organizationId,
        hostelId,
        select: "resident_id,status,expires_at,used_at,revoked_at",
        deletedAtNull: true,
        limit: 50_000,
      }),
      this.operationsRepository.list("monthly_fee_records", {
        organizationId: values.organizationId,
        hostelId,
        select: "resident_id,balance_amount,status,due_date,period_month",
        ...(monthStart ? { equals: { period_month: monthStart } } : {}),
        deletedAtNull: true,
        limit: 50_000,
      }),
      this.operationsRepository.list("leave_requests", {
        organizationId: values.organizationId,
        hostelId,
        select: "resident_id,status,from_date,to_date",
        in: { status: ["pending", "approved"] },
        deletedAtNull: true,
        limit: 50_000,
      }),
      this.operationsRepository.list("room_allocations", {
        organizationId: values.organizationId,
        hostelId,
        select: "resident_id,room_id,bed_label,status",
        equals: { status: "active" },
        deletedAtNull: true,
        limit: 50_000,
      }),
      this.loadAdvanceBalances(values.organizationId, hostelId),
    ])
    const roomRows = rooms
      .map((room) => ({
        resident_id: String(room.resident_id),
        room_id: typeof room.room_id === "string" ? room.room_id : null,
        room_label:
          typeof room.bed_label === "string" && room.bed_label
            ? room.bed_label
            : typeof room.room_id === "string"
              ? room.room_id.slice(0, 8)
              : null,
      }))
      .filter((room) => !values.roomId || room.room_id === values.roomId)
    const allowedResidentIds = values.roomId
      ? new Set(roomRows.map((room) => room.resident_id))
      : null
    const controlCenter = buildResidentLifecycleControlCenter({
      residents: residents
        .filter((resident) => !allowedResidentIds || allowedResidentIds.has(String(resident.id)))
        .map((resident) => ({
          id: String(resident.id),
          full_name: String(resident.full_name ?? "Resident"),
          admission_number:
            typeof resident.admission_number === "string" ? resident.admission_number : null,
          phone: typeof resident.phone === "string" ? resident.phone : null,
          hostel_id: String(resident.hostel_id),
          status: String(resident.status ?? "draft"),
          onboarding_status:
            typeof resident.onboarding_status === "string"
              ? resident.onboarding_status
              : null,
          is_active: typeof resident.is_active === "boolean" ? resident.is_active : null,
          user_id: typeof resident.user_id === "string" ? resident.user_id : null,
          joined_on: typeof resident.joined_on === "string" ? resident.joined_on : null,
          checkout_on: typeof resident.checkout_on === "string" ? resident.checkout_on : null,
        })),
      invites: invites.map((invite) => ({
        resident_id: String(invite.resident_id),
        status: String(invite.status ?? "pending"),
        expires_at: String(invite.expires_at ?? ""),
        used_at: typeof invite.used_at === "string" ? invite.used_at : null,
        revoked_at: typeof invite.revoked_at === "string" ? invite.revoked_at : null,
      })),
      feeRecords: feeRecords.map((fee) => ({
        resident_id: String(fee.resident_id),
        balance_amount: Number(fee.balance_amount ?? 0),
        status: String(fee.status ?? "pending"),
        due_date: String(fee.due_date ?? ""),
        period_month: String(fee.period_month ?? ""),
      })),
      leaves: leaves.map((leave) => ({
        resident_id: String(leave.resident_id),
        status: String(leave.status ?? "pending"),
        from_date: String(leave.from_date ?? ""),
        to_date: String(leave.to_date ?? ""),
      })),
      rooms: roomRows,
      advances: advanceRows,
    })

    if (!values.search) {
      return controlCenter
    }

    return filterControlCenter(controlCenter, values.search)
  }

  private async loadAdvanceBalances(organizationId: string, hostelId?: string | null) {
    const [deposits, allocations, refunds] = await Promise.all([
      this.advanceRepository.listDeposits({ organizationId, hostelId }),
      this.advanceRepository.listAllocations({ organizationId, hostelId }),
      this.advanceRepository.listRefunds({ organizationId, hostelId }),
    ])
    const residentIds = Array.from(
      new Set([
        ...deposits.map((deposit) => deposit.resident_id),
        ...allocations.map((allocation) => allocation.resident_id),
        ...refunds.map((refund) => refund.resident_id),
      ])
    )

    return residentIds.map((residentId) => {
      const balance = calculateAdvanceBalance({
        deposits: deposits.filter((deposit) => deposit.resident_id === residentId),
        allocations: allocations.filter((allocation) => allocation.resident_id === residentId),
        refunds: refunds.filter((refund) => refund.resident_id === residentId),
      })

      return {
        residentId,
        remainingAdvanceBalance: balance.remainingAdvanceBalance,
      }
    })
  }
}

function filterControlCenter(
  controlCenter: Awaited<ReturnType<typeof buildResidentLifecycleControlCenter>>,
  search: string
) {
  const query = search.trim().toLowerCase()
  const allCards = controlCenter.allCards.filter((card) =>
    card.searchIndex.includes(query)
  )
  const allCardIds = new Set(allCards.map((card) => card.residentId))

  return {
    ...controlCenter,
    allCards,
    columns: controlCenter.columns.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => allCardIds.has(card.residentId)),
    })),
  }
}
