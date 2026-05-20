import "@testing-library/jest-dom/vitest"

import { afterEach, vi } from "vitest"

vi.mock("server-only", () => ({}))

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test-project.supabase.co"
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key"
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key"
process.env.LOG_LEVEL ??= "error"
process.env.RATE_LIMIT_ENABLED ??= "true"
process.env.STORAGE_SIGNED_URL_TTL_SECONDS ??= "3600"

afterEach(() => {
  vi.clearAllMocks()
})
