import { apiClient } from "@/lib/api-client"
import type {
  AdmissionsAnalytics,
  HostelVacancyRow,
  LeadNoteRow,
  LeadRow,
  ReservationPaymentRow,
  ReservationRow,
  RoomVacancyRow,
} from "@/types/admissions"
import type { Tables } from "@/types/database"
import type {
  AddLeadNoteInput,
  CancelReservationInput,
  ConvertReservationInput,
  CreateLeadInput,
  CreateReservationInput,
  CreateReservationPaymentInput,
  LeadIdMutationInput,
  LeadListInput,
  PublicInquiryInput,
  ReservationIdInput,
  ReservationListInput,
  UpdateLeadInput,
  VacancyQueryInput,
  VerifyReservationPaymentInput,
} from "@/validations/admission.validation"

import type { PaginatedResult } from "./types"

export type VacancyPayload = {
  hostels: HostelVacancyRow[]
  rooms: RoomVacancyRow[]
  summary: HostelVacancyRow | null
}

export const admissionsSdk = {
  getPublicVacancy(params?: VacancyQueryInput) {
    return apiClient.get<VacancyPayload>("/api/admissions/vacancy", params, {
      auth: false,
    })
  },

  submitPublicInquiry(input: PublicInquiryInput) {
    return apiClient.post<
      { id: string; status: LeadRow["status"]; createdAt: string; deduplicated?: boolean },
      PublicInquiryInput
    >("/api/admissions/public-inquiry", input, {
      auth: false,
    })
  },

  listLeads(params: LeadListInput) {
    return apiClient.get<PaginatedResult<LeadRow>>("/api/admissions/leads", params)
  },

  createLead(input: CreateLeadInput) {
    return apiClient.post<LeadRow, CreateLeadInput>("/api/admissions/leads", input)
  },

  updateLead(input: UpdateLeadInput) {
    const { leadId, ...body } = input

    return apiClient.patch<LeadRow, Omit<UpdateLeadInput, "leadId">>(
      `/api/admissions/leads/${leadId}`,
      body
    )
  },

  removeLead(input: LeadIdMutationInput) {
    const { leadId, ...query } = input

    return apiClient.delete<LeadRow>(`/api/admissions/leads/${leadId}`, query)
  },

  addLeadNote(input: AddLeadNoteInput) {
    const { leadId, ...body } = input

    return apiClient.post<LeadNoteRow, Omit<AddLeadNoteInput, "leadId">>(
      `/api/admissions/leads/${leadId}/notes`,
      body
    )
  },

  listReservations(params: ReservationListInput) {
    return apiClient.get<PaginatedResult<ReservationRow>>(
      "/api/admissions/reservations",
      params
    )
  },

  createReservation(input: CreateReservationInput) {
    return apiClient.post<ReservationRow, CreateReservationInput>(
      "/api/admissions/reservations",
      input
    )
  },

  confirmReservation(input: ReservationIdInput) {
    const { reservationId, ...body } = input

    return apiClient.patch<ReservationRow, Omit<ReservationIdInput, "reservationId">>(
      `/api/admissions/reservations/${reservationId}/confirm`,
      body
    )
  },

  cancelReservation(input: CancelReservationInput) {
    const { reservationId, ...body } = input

    return apiClient.patch<ReservationRow, Omit<CancelReservationInput, "reservationId">>(
      `/api/admissions/reservations/${reservationId}/cancel`,
      body
    )
  },

  convertReservation(input: ConvertReservationInput) {
    const { reservationId, ...body } = input

    return apiClient.post<Tables<"residents">, Omit<ConvertReservationInput, "reservationId">>(
      `/api/admissions/reservations/${reservationId}/convert`,
      body
    )
  },

  createReservationPayment(input: CreateReservationPaymentInput) {
    const { reservationId, ...body } = input

    return apiClient.post<
      ReservationPaymentRow,
      Omit<CreateReservationPaymentInput, "reservationId">
    >(`/api/admissions/reservations/${reservationId}/advance-payment`, body)
  },

  verifyReservationPayment(input: VerifyReservationPaymentInput) {
    const { paymentId, ...body } = input

    return apiClient.patch<
      ReservationPaymentRow,
      Omit<VerifyReservationPaymentInput, "paymentId">
    >(`/api/admissions/reservations/advance-payments/${paymentId}/verify`, body)
  },

  getAnalytics(params: VacancyQueryInput) {
    return apiClient.get<AdmissionsAnalytics>("/api/admissions/analytics", params)
  },
}
