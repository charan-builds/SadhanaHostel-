"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { admissionsSdk } from "@/sdk"
import type {
  AddLeadNoteInput,
  CancelReservationInput,
  ConvertReservationInput,
  CreateLeadInput,
  CreateReservationInput,
  CreateReservationPaymentInput,
  LeadListInput,
  PublicInquiryInput,
  ReservationIdInput,
  ReservationListInput,
  UpdateLeadInput,
  VacancyQueryInput,
  VerifyReservationPaymentInput,
} from "@/validations/admission.validation"

export function usePublicVacancy(params: VacancyQueryInput = {}) {
  return useQuery({
    queryKey: queryKeys.admissions.vacancy(params),
    queryFn: () => admissionsSdk.getPublicVacancy(params),
    staleTime: 30_000,
  })
}

export function useAdmissionsVacancy(params: VacancyQueryInput) {
  return useQuery({
    queryKey: queryKeys.admissions.vacancy(params),
    queryFn: () => admissionsSdk.getPublicVacancy(params),
    enabled: Boolean(params.organizationId),
    staleTime: 15_000,
  })
}

export function useLeads(params: LeadListInput) {
  return useQuery({
    queryKey: queryKeys.admissions.leads(params, params),
    queryFn: () => admissionsSdk.listLeads(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useReservations(params: ReservationListInput) {
  return useQuery({
    queryKey: queryKeys.admissions.reservations(params, params),
    queryFn: () => admissionsSdk.listReservations(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useAdmissionsAnalytics(params: VacancyQueryInput) {
  return useQuery({
    queryKey: queryKeys.admissions.analytics(params),
    queryFn: () => admissionsSdk.getAnalytics(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useSubmitPublicInquiry() {
  return useMutation({
    mutationFn: (input: PublicInquiryInput) => admissionsSdk.submitPublicInquiry(input),
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateLeadInput) => admissionsSdk.createLead(input),
    onSuccess: (lead) => invalidateAdmissions(queryClient, lead.organization_id, lead.hostel_id),
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateLeadInput) => admissionsSdk.updateLead(input),
    onSuccess: (lead) => invalidateAdmissions(queryClient, lead.organization_id, lead.hostel_id),
  })
}

export function useAddLeadNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AddLeadNoteInput) => admissionsSdk.addLeadNote(input),
    onSuccess: (note) => invalidateAdmissions(queryClient, note.organization_id, note.hostel_id),
  })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateReservationInput) => admissionsSdk.createReservation(input),
    onSuccess: (reservation) =>
      invalidateAdmissions(queryClient, reservation.organization_id, reservation.hostel_id),
  })
}

export function useConfirmReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ReservationIdInput) => admissionsSdk.confirmReservation(input),
    onSuccess: (reservation) =>
      invalidateAdmissions(queryClient, reservation.organization_id, reservation.hostel_id),
  })
}

export function useCancelReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CancelReservationInput) => admissionsSdk.cancelReservation(input),
    onSuccess: (reservation) =>
      invalidateAdmissions(queryClient, reservation.organization_id, reservation.hostel_id),
  })
}

export function useConvertReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ConvertReservationInput) => admissionsSdk.convertReservation(input),
    onSuccess: (resident) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admissions.all({
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
        }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.residents.all({
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
        }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rooms.all({
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
        }),
      })
    },
  })
}

export function useCreateReservationPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateReservationPaymentInput) =>
      admissionsSdk.createReservationPayment(input),
    onSuccess: (payment) =>
      invalidateAdmissions(queryClient, payment.organization_id, payment.hostel_id),
  })
}

export function useVerifyReservationPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: VerifyReservationPaymentInput) =>
      admissionsSdk.verifyReservationPayment(input),
    onSuccess: (payment) =>
      invalidateAdmissions(queryClient, payment.organization_id, payment.hostel_id),
  })
}

function invalidateAdmissions(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  hostelId?: string | null
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.admissions.all({ organizationId, hostelId }),
  })
}
