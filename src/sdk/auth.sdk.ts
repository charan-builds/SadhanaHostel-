import { apiClient } from "@/lib/api-client"
import type {
  ChangePasswordInput,
  LoginInput,
  ResetPasswordInput,
} from "@/validations/auth.validation"

import type { SessionOverview } from "./types"

export const authSdk = {
  login(input: LoginInput) {
    return apiClient.post<SessionOverview, LoginInput>("/api/auth/login", input, {
      auth: false,
      retry: 0,
    })
  },

  logout() {
    return apiClient.post<{ success: boolean }>("/api/auth/logout", undefined, {
      retry: 0,
    })
  },

  resetPassword(input: ResetPasswordInput) {
    return apiClient.post<{ success: boolean }, ResetPasswordInput>(
      "/api/auth/reset-password",
      input,
      { retry: 0 }
    )
  },

  changePassword(input: ChangePasswordInput) {
    return apiClient.post<SessionOverview, ChangePasswordInput>(
      "/api/auth/change-password",
      input,
      { retry: 0 }
    )
  },

  session() {
    return apiClient.get<SessionOverview>("/api/auth/session", undefined, {
      auth: false,
      retry: 0,
    })
  },
}
