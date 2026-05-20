import { vi } from "vitest"

import { createSupabaseAuthMock } from "./supabase-auth.mock"
import { createSupabaseStorageMock } from "./storage.mock"

export function createSupabaseClientMock() {
  const auth = createSupabaseAuthMock()
  const { storage, bucket } = createSupabaseStorageMock()

  return {
    client: {
      auth,
      storage,
      from: vi.fn(),
      rpc: vi.fn(),
    },
    auth,
    storage,
    bucket,
  }
}
