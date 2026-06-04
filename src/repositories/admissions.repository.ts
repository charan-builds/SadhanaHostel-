import type { PostgrestError } from "@supabase/supabase-js"

import type {
  AdmissionsAnalytics,
  HostelCapacityRow,
  HostelVacancyRow,
  LeadActivityRow,
  LeadNoteRow,
  LeadRow,
  LeadStatus,
  ReservationPaymentRow,
  ReservationRow,
  ReservationStatus,
  RoomCapacityRow,
  RoomVacancyRow,
} from "@/types/admissions"
import type { Json } from "@/types/database"

import {
  createPaginationMeta,
  normalizePagination,
  sanitizeSearchTerm,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
  type PaginationParams,
} from "./types"

type QueryResult<T> = {
  data: T | null
  error: PostgrestError | null
}

type CountedQueryResult<T> = QueryResult<T> & {
  count: number | null
}

type GenericQueryBuilder = {
  select(columns?: string, options?: { count?: "exact" }): GenericQueryBuilder
  insert(values: unknown): GenericQueryBuilder
  update(values: unknown): GenericQueryBuilder
  delete(): GenericQueryBuilder
  eq(column: string, value: unknown): GenericQueryBuilder
  neq(column: string, value: unknown): GenericQueryBuilder
  is(column: string, value: boolean | null): GenericQueryBuilder
  in(column: string, values: unknown[]): GenericQueryBuilder
  gte(column: string, value: unknown): GenericQueryBuilder
  lte(column: string, value: unknown): GenericQueryBuilder
  or(filters: string): GenericQueryBuilder
  order(column: string, options?: { ascending?: boolean }): GenericQueryBuilder
  limit(count: number): GenericQueryBuilder
  range(from: number, to: number): Promise<CountedQueryResult<unknown[]>>
  single(): Promise<QueryResult<unknown>>
  maybeSingle(): Promise<QueryResult<unknown>>
}

type GenericAdmissionDb = {
  from(table: string): GenericQueryBuilder
  rpc(functionName: string, args?: Record<string, unknown>): Promise<QueryResult<unknown>>
}

export type CreateLeadValues = {
  organization_id: string
  hostel_id?: string | null
  full_name: string
  phone: string
  whatsapp_number?: string | null
  email?: string | null
  resident_type: "student" | "employee" | "other"
  desired_joining_date?: string | null
  expected_stay_duration?: string | null
  parent_name?: string | null
  parent_phone?: string | null
  notes?: string | null
  source: string
  status?: LeadStatus
  assigned_to?: string | null
  next_follow_up_at?: string | null
  created_by?: string | null
  updated_by?: string | null
  metadata?: Json
}

export type UpdateLeadValues = Partial<Omit<CreateLeadValues, "organization_id">> & {
  status?: LeadStatus
  last_contacted_at?: string | null
  cancelled_reason?: string | null
}

export type ListLeadFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  status?: LeadStatus
  source?: string
  search?: string
  followUp?: "due" | "upcoming"
}

export type ListReservationFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  status?: ReservationStatus
  leadId?: string
  roomId?: string
  search?: string
}

export class AdmissionsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async getDefaultTenant() {
    const { data: organizations, error: organizationError } = await this.admissionDb()
      .from("organizations")
      .select("id")
      .eq("status", "active")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(0, 0)

    if (organizationError) {
      throwRepositoryError(organizationError, "Unable to resolve default organization.")
    }

    const organization = (organizations ?? [])[0] as { id: string } | undefined

    if (!organization) {
      return null
    }

    const { data: hostels, error: hostelError } = await this.admissionDb()
      .from("hostels")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(0, 0)

    if (hostelError) {
      throwRepositoryError(hostelError, "Unable to resolve default hostel.")
    }

    const hostel = (hostels ?? [])[0] as { id: string } | undefined

    return {
      organizationId: organization.id,
      hostelId: hostel?.id,
    }
  }

  async getVacancy(organizationId: string, hostelId?: string) {
    let query = this.admissionDb()
      .from("hostel_vacancy_view")
      .select("*")
      .eq("organization_id", organizationId)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query
      .order("hostel_name", { ascending: true })
      .range(0, 100)

    if (error) {
      throwRepositoryError(error, "Unable to load hostel vacancy.")
    }

    return (data ?? []) as HostelVacancyRow[]
  }

  async listRoomVacancy(organizationId: string, hostelId?: string) {
    let query = this.admissionDb()
      .from("room_vacancy_view")
      .select("*")
      .eq("organization_id", organizationId)
      .order("room_number", { ascending: true })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.range(0, 500)

    if (error) {
      throwRepositoryError(error, "Unable to load room vacancy.")
    }

    return (data ?? []) as RoomVacancyRow[]
  }

  async getHostelCapacity(organizationId: string, hostelId: string) {
    const { data, error } = await this.admissionDb()
      .from("hostel_capacity")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("hostel_id", hostelId)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load hostel capacity.")
    }

    return data as HostelCapacityRow | null
  }

  async updateHostelCapacity(
    organizationId: string,
    hostelId: string,
    values: Partial<HostelCapacityRow>
  ) {
    const { data, error } = await this.admissionDb()
      .from("hostel_capacity")
      .update(values)
      .eq("organization_id", organizationId)
      .eq("hostel_id", hostelId)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update hostel capacity.")
    }

    return data as HostelCapacityRow
  }

  async upsertRoomCapacity(values: Partial<RoomCapacityRow> & {
    organization_id: string
    hostel_id: string
    room_id: string
    total_beds: number
  }) {
    const { data, error } = await this.admissionDb()
      .from("room_capacity")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create room capacity record.")
    }

    return data as RoomCapacityRow
  }

  async listLeads(filters: ListLeadFilters): Promise<PaginatedResult<LeadRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)
    const search = sanitizeSearchTerm(filters.search)
    let query = this.admissionDb()
      .from("leads")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.source) {
      query = query.eq("source", filters.source)
    }

    if (filters.followUp === "due") {
      query = query.lte("next_follow_up_at", new Date().toISOString())
    } else if (filters.followUp === "upcoming") {
      query = query.gte("next_follow_up_at", new Date().toISOString())
    }

    if (search) {
      query = query.or(
        [
          `full_name.ilike.%${search}%`,
          `phone.ilike.%${search}%`,
          `whatsapp_number.ilike.%${search}%`,
          `email.ilike.%${search}%`,
        ].join(",")
      )
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list leads.")
    }

    return {
      data: (data ?? []) as LeadRow[],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async getLeadById(leadId: string, organizationId: string) {
    const { data, error } = await this.admissionDb()
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load lead.")
    }

    return data as LeadRow | null
  }

  async createLead(values: CreateLeadValues) {
    const { data, error } = await this.admissionDb()
      .from("leads")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create lead.")
    }

    return data as LeadRow
  }

  async findRecentLeadByPhone(
    organizationId: string,
    hostelId: string | undefined,
    phone: string,
    sinceIso: string
  ) {
    let query = this.admissionDb()
      .from("leads")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("phone", phone)
      .gte("created_at", sinceIso)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.range(0, 0)

    if (error) {
      throwRepositoryError(error, "Unable to check recent inquiry.")
    }

    return (data ?? [])[0] as LeadRow | undefined
  }

  async updateLead(leadId: string, organizationId: string, values: UpdateLeadValues) {
    const { data, error } = await this.admissionDb()
      .from("leads")
      .update(values)
      .eq("id", leadId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update lead.")
    }

    return data as LeadRow
  }

  async removeLead(leadId: string, organizationId: string, actorUserId: string) {
    const now = new Date().toISOString()
    const { data, error } = await this.admissionDb()
      .from("leads")
      .update({
        is_active: false,
        deleted_at: now,
        deleted_by: actorUserId,
        updated_by: actorUserId,
      })
      .eq("id", leadId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to remove lead.")
    }

    return data as LeadRow
  }

  async addLeadNote(values: {
    organization_id: string
    hostel_id?: string | null
    lead_id: string
    note: string
    is_pinned: boolean
    created_by?: string | null
    updated_by?: string | null
  }) {
    const { data, error } = await this.admissionDb()
      .from("lead_notes")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to add lead note.")
    }

    return data as LeadNoteRow
  }

  async listLeadActivity(leadId: string, organizationId: string) {
    const { data, error } = await this.admissionDb()
      .from("lead_activity_logs")
      .select("*")
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(0, 49)

    if (error) {
      throwRepositoryError(error, "Unable to load lead activity.")
    }

    return (data ?? []) as LeadActivityRow[]
  }

  async listReservations(
    filters: ListReservationFilters
  ): Promise<PaginatedResult<ReservationRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)
    const search = sanitizeSearchTerm(filters.search)
    let query = this.admissionDb()
      .from("reservations")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.leadId) {
      query = query.eq("lead_id", filters.leadId)
    }

    if (filters.roomId) {
      query = query.eq("reserved_room_id", filters.roomId)
    }

    if (search) {
      const leadIds = await this.findLeadIdsForReservationSearch(
        filters.organizationId,
        filters.hostelId,
        search
      )

      if (isUuid(search)) {
        const reservationFilters = [`id.eq.${search}`, `lead_id.eq.${search}`]

        if (leadIds.length > 0) {
          reservationFilters.push(`lead_id.in.(${leadIds.join(",")})`)
        }

        query = query.or(reservationFilters.join(","))
      } else if (leadIds.length > 0) {
        query = query.in("lead_id", leadIds)
      } else {
        return {
          data: [],
          meta: createPaginationMeta(0, page, pageSize),
        }
      }
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list reservations.")
    }

    return {
      data: (data ?? []) as ReservationRow[],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  private async findLeadIdsForReservationSearch(
    organizationId: string,
    hostelId: string | undefined,
    search: string
  ) {
    let query = this.admissionDb()
      .from("leads")
      .select("id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .or(
        [
          `full_name.ilike.%${search}%`,
          `phone.ilike.%${search}%`,
          `whatsapp_number.ilike.%${search}%`,
          `email.ilike.%${search}%`,
        ].join(",")
      )

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.range(0, 100)

    if (error) {
      throwRepositoryError(error, "Unable to search reservation leads.")
    }

    return ((data ?? []) as Array<{ id: string }>).map((lead) => lead.id)
  }

  async getReservationById(reservationId: string, organizationId: string) {
    const { data, error } = await this.admissionDb()
      .from("reservations")
      .select("*")
      .eq("id", reservationId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load reservation.")
    }

    return data as ReservationRow | null
  }

  async createReservationAtomic(values: {
    organizationId: string
    hostelId: string
    leadId: string
    reservedRoomId?: string
    reservedBedCount: number
    reservedUntil: string
    advanceAmount: number
    notes?: string
    actorUserId: string
  }) {
    const { data, error } = await this.admissionDb().rpc("create_reservation_atomic", {
      p_organization_id: values.organizationId,
      p_hostel_id: values.hostelId,
      p_lead_id: values.leadId,
      p_reserved_room_id: values.reservedRoomId ?? null,
      p_reserved_bed_count: values.reservedBedCount,
      p_reserved_until: values.reservedUntil,
      p_advance_amount: values.advanceAmount,
      p_notes: values.notes ?? null,
      p_actor_user_id: values.actorUserId,
    })

    if (error) {
      throwRepositoryError(error, "Unable to create reservation.")
    }

    return data as ReservationRow
  }

  async updateReservation(
    reservationId: string,
    organizationId: string,
    values: Partial<ReservationRow>
  ) {
    const { data, error } = await this.admissionDb()
      .from("reservations")
      .update(values)
      .eq("id", reservationId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update reservation.")
    }

    return data as ReservationRow
  }

  async createReservationPayment(values: {
    organization_id: string
    hostel_id: string
    reservation_id: string
    lead_id: string
    amount: number
    method: string
    status: string
    transaction_id?: string | null
    proof_document_id?: string | null
    paid_at?: string | null
    notes?: string | null
    created_by?: string | null
    updated_by?: string | null
  }) {
    const { data, error } = await this.admissionDb()
      .from("reservation_payments")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create reservation payment.")
    }

    return data as ReservationPaymentRow
  }

  async getReservationPaymentById(paymentId: string, organizationId: string) {
    const { data, error } = await this.admissionDb()
      .from("reservation_payments")
      .select("*")
      .eq("id", paymentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load reservation payment.")
    }

    return data as ReservationPaymentRow | null
  }

  async verifyReservationPaymentAtomic(values: {
    organizationId: string
    paymentId: string
    actorUserId: string
    notes?: string
  }) {
    const { data, error } = await this.admissionDb().rpc(
      "verify_reservation_payment_atomic",
      {
        p_organization_id: values.organizationId,
        p_payment_id: values.paymentId,
        p_actor_user_id: values.actorUserId,
        p_notes: values.notes ?? null,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to verify reservation payment.")
    }

    return data as ReservationPaymentRow
  }

  async convertReservationAtomic(values: {
    organizationId: string
    reservationId: string
    joinedOn: string
    monthlyFeeAmount?: number
    securityDepositAmount: number
    actorUserId: string
  }) {
    const { data, error } = await this.admissionDb().rpc(
      "convert_reservation_to_resident_atomic",
      {
        p_organization_id: values.organizationId,
        p_reservation_id: values.reservationId,
        p_joined_on: values.joinedOn,
        p_monthly_fee_amount: values.monthlyFeeAmount ?? null,
        p_security_deposit_amount: values.securityDepositAmount,
        p_actor_user_id: values.actorUserId,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to convert reservation.")
    }

    return data as unknown
  }

  async expireReservations(values: {
    organizationId?: string
    hostelId?: string
    limit?: number
  }) {
    const { data, error } = await this.admissionDb().rpc("expire_reservations", {
      p_organization_id: values.organizationId ?? null,
      p_hostel_id: values.hostelId ?? null,
      p_limit: values.limit ?? 200,
    })

    if (error) {
      throwRepositoryError(error, "Unable to expire reservations.")
    }

    const rows = (data ?? []) as Array<{ expired_count: number }>

    return rows[0]?.expired_count ?? 0
  }

  async recalculateHostelCapacity(organizationId: string, hostelId: string) {
    const { data, error } = await this.admissionDb().rpc("recalculate_hostel_capacity", {
      p_organization_id: organizationId,
      p_hostel_id: hostelId,
    })

    if (error) {
      throwRepositoryError(error, "Unable to recalculate hostel capacity.")
    }

    return data as HostelCapacityRow
  }

  async listDueFollowUps(organizationId: string, limit = 100) {
    const { data, error } = await this.admissionDb()
      .from("leads")
      .select("*")
      .eq("organization_id", organizationId)
      .in("status", ["new_inquiry", "called", "interested"])
      .lte("next_follow_up_at", new Date().toISOString())
      .is("deleted_at", null)
      .order("next_follow_up_at", { ascending: true })
      .range(0, Math.max(0, limit - 1))

    if (error) {
      throwRepositoryError(error, "Unable to load due lead follow-ups.")
    }

    return (data ?? []) as LeadRow[]
  }

  async markInactiveLeadsCancelled(organizationId: string, olderThanIso: string) {
    const { data, error } = await this.admissionDb()
      .from("leads")
      .update({
        status: "cancelled",
        cancelled_reason: "Auto-closed after inactivity.",
      })
      .eq("organization_id", organizationId)
      .in("status", ["new_inquiry", "called", "interested"])
      .lte("updated_at", olderThanIso)
      .is("deleted_at", null)
      .select("id")
      .range(0, 9999)

    if (error) {
      throwRepositoryError(error, "Unable to clean up inactive leads.")
    }

    return (data ?? []).length
  }

  async getAnalytics(organizationId: string, hostelId?: string): Promise<AdmissionsAnalytics> {
    let leadQuery = this.admissionDb()
      .from("leads")
      .select("status,next_follow_up_at", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)

    let reservationQuery = this.admissionDb()
      .from("reservations")
      .select("status", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)

    if (hostelId) {
      leadQuery = leadQuery.eq("hostel_id", hostelId)
      reservationQuery = reservationQuery.eq("hostel_id", hostelId)
    }

    const [leadResult, reservationResult] = await Promise.all([
      leadQuery.range(0, 5000),
      reservationQuery.range(0, 5000),
    ])

    if (leadResult.error) {
      throwRepositoryError(leadResult.error, "Unable to load lead analytics.")
    }

    if (reservationResult.error) {
      throwRepositoryError(
        reservationResult.error,
        "Unable to load reservation analytics."
      )
    }

    const leads = (leadResult.data ?? []) as Pick<
      LeadRow,
      "status" | "next_follow_up_at"
    >[]
    const reservations = (reservationResult.data ?? []) as Pick<ReservationRow, "status">[]
    const joinedLeads = leads.filter((lead) => lead.status === "joined").length
    const cancelledLeads = leads.filter((lead) => lead.status === "cancelled").length
    const totalLeads = leadResult.count ?? leads.length
    const pendingFollowUps = leads.filter(
      (lead) =>
        lead.next_follow_up_at &&
        new Date(lead.next_follow_up_at).getTime() <= Date.now()
    ).length

    return {
      totalLeads,
      newInquiries: leads.filter((lead) => lead.status === "new_inquiry").length,
      interestedLeads: leads.filter((lead) => lead.status === "interested").length,
      activeReservations: reservations.filter((reservation) =>
        ["pending", "reserved"].includes(reservation.status)
      ).length,
      confirmedReservations: reservations.filter(
        (reservation) => reservation.status === "confirmed"
      ).length,
      joinedLeads,
      cancelledLeads,
      conversionRate: totalLeads > 0 ? Math.round((joinedLeads / totalLeads) * 100) : 0,
      cancellationRate:
        totalLeads > 0 ? Math.round((cancelledLeads / totalLeads) * 100) : 0,
      pendingFollowUps,
    }
  }

  private admissionDb() {
    return this.db as unknown as GenericAdmissionDb
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}
