"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { invitesSdk } from "@/sdk"
import type {
  ActivateInviteInput,
  CreateResidentInviteInput,
  ListResidentInvitesInput,
  ResidentInviteActionInput,
  ValidateInviteInput,
} from "@/validations/invite.validation"

export function useResidentInvites(params: ListResidentInvitesInput) {
  return useQuery({
    queryKey: queryKeys.invites.resident(params, params.residentId),
    queryFn: () => invitesSdk.listResidentInvites(params),
    enabled: Boolean(params.organizationId && params.residentId),
  })
}

export function useCreateResidentInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateResidentInviteInput) =>
      invitesSdk.createResidentInvite(input),
    onSuccess: (result) => {
      invalidateResidentInvites(
        queryClient,
        result.invite.organization_id,
        result.invite.hostel_id,
        result.invite.resident_id
      )
    },
  })
}

export function useResendResidentInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ResidentInviteActionInput) =>
      invitesSdk.resendResidentInvite(input),
    onSuccess: (result) => {
      invalidateResidentInvites(
        queryClient,
        result.invite.organization_id,
        result.invite.hostel_id,
        result.invite.resident_id
      )
    },
  })
}

export function useRevokeResidentInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ResidentInviteActionInput) =>
      invitesSdk.revokeResidentInvite(input),
    onSuccess: (invite) => {
      invalidateResidentInvites(
        queryClient,
        invite.organization_id,
        invite.hostel_id,
        invite.resident_id
      )
    },
  })
}

export function useValidateInvite() {
  return useMutation({
    mutationFn: (input: ValidateInviteInput) => invitesSdk.validateInvite(input),
  })
}

export function useActivateInvite() {
  return useMutation({
    mutationFn: (input: ActivateInviteInput) => invitesSdk.activateInvite(input),
  })
}

function invalidateResidentInvites(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  hostelId: string | null,
  residentId: string
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.invites.resident({ organizationId, hostelId }, residentId),
  })
  void queryClient.invalidateQueries({
    queryKey: queryKeys.residents.all({ organizationId, hostelId }),
  })
}
