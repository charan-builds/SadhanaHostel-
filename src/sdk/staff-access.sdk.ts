import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  CreateStaffUserInput,
  ListStaffUsersInput,
  StaffAccessActionInput,
  UpdateStaffAccessInput,
} from "@/validations/staff-access.validation"

import type { PaginatedResult } from "./types"

export type StaffAccessAccount = Tables<"user_roles"> & {
  user: Tables<"users">
  hostel: Pick<Tables<"hostels">, "id" | "name" | "code"> | null
  accountState: string
  forcePasswordReset: boolean
}

export type CreatedStaffAccess = {
  account: StaffAccessAccount
  inviteLink: string | null
  temporaryPassword: string | null
  expiresAt: string
}

export type StaffPasswordResetResult = {
  targetUserId: string
  temporaryPassword: string
  expiresAt: string
}

export const staffAccessSdk = {
  list(params: ListStaffUsersInput) {
    return apiClient.get<PaginatedResult<StaffAccessAccount>>(
      "/api/staff-access/users",
      params
    )
  },

  create(input: CreateStaffUserInput) {
    return apiClient.post<CreatedStaffAccess, CreateStaffUserInput>(
      "/api/staff-access/users",
      input
    )
  },

  update(input: UpdateStaffAccessInput) {
    const { targetUserId, ...body } = input

    return apiClient.patch<Tables<"user_roles">, Omit<UpdateStaffAccessInput, "targetUserId">>(
      `/api/staff-access/users/${targetUserId}`,
      body
    )
  },

  revoke(input: StaffAccessActionInput) {
    const { targetUserId, ...body } = input

    return apiClient.post<Tables<"user_roles">, Omit<StaffAccessActionInput, "targetUserId">>(
      `/api/staff-access/users/${targetUserId}/revoke`,
      body
    )
  },

  resetPassword(input: StaffAccessActionInput) {
    const { targetUserId, ...body } = input

    return apiClient.post<StaffPasswordResetResult, Omit<StaffAccessActionInput, "targetUserId">>(
      `/api/staff-access/users/${targetUserId}/reset-password`,
      body
    )
  },
}
