import { apiClient } from "@/lib/api-client"
import type {
  ResidentActivationResult,
  ResidentInviteCreated,
  ResidentInviteRow,
  ResidentInviteSafe,
} from "@/types/invites"
import type {
  ActivateInviteInput,
  CreateResidentInviteInput,
  ListResidentInvitesInput,
  ResidentInviteActionInput,
  ValidateInviteInput,
} from "@/validations/invite.validation"

export const invitesSdk = {
  listResidentInvites(params: ListResidentInvitesInput) {
    return apiClient.get<ResidentInviteRow[]>("/api/resident-invites", params)
  },

  createResidentInvite(input: CreateResidentInviteInput) {
    return apiClient.post<ResidentInviteCreated, CreateResidentInviteInput>(
      "/api/resident-invites",
      input
    )
  },

  resendResidentInvite(input: ResidentInviteActionInput) {
    const { inviteId, ...body } = input

    return apiClient.post<
      ResidentInviteCreated,
      Omit<ResidentInviteActionInput, "inviteId">
    >(`/api/resident-invites/${inviteId}/resend`, body)
  },

  revokeResidentInvite(input: ResidentInviteActionInput) {
    const { inviteId, ...body } = input

    return apiClient.post<
      ResidentInviteRow,
      Omit<ResidentInviteActionInput, "inviteId">
    >(`/api/resident-invites/${inviteId}/revoke`, body)
  },

  validateInvite(input: ValidateInviteInput) {
    return apiClient.post<ResidentInviteSafe, ValidateInviteInput>(
      "/api/activation/validate",
      input,
      { auth: false, retry: 0 }
    )
  },

  activateInvite(input: ActivateInviteInput) {
    return apiClient.post<ResidentActivationResult, ActivateInviteInput>(
      "/api/activation/activate",
      input,
      { auth: false, retry: 0 }
    )
  },
}
