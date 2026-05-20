import { vi } from "vitest"

import { authUserFixture } from "@/tests/fixtures"

export function createSupabaseAuthMock() {
  return {
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: authUserFixture(),
      },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: {
        user: authUserFixture(),
        session: {
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
        },
      },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({
      error: null,
    }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({
      data: {},
      error: null,
    }),
  }
}
