import type { Tables, TablesInsert } from "@/types/database"

import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "./organizations"

export const ADMIN_USER_ID = "00000000-0000-4000-8000-000000000011"
export const RESIDENT_USER_ID = "00000000-0000-4000-8000-000000000012"
export const OTHER_RESIDENT_USER_ID = "00000000-0000-4000-8000-000000000112"

export function userFixture(
  overrides: Partial<Tables<"users">> = {}
): Tables<"users"> {
  return {
    id: ADMIN_USER_ID,
    organization_id: TEST_ORGANIZATION_ID,
    full_name: "Admin User",
    email: "admin.test@sadhanahostel.example",
    phone: "+91 90000 00001",
    default_role: "admin",
    avatar_document_id: null,
    is_platform_user: false,
    is_active: true,
    last_login_at: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

export function userRoleFixture(
  overrides: Partial<Tables<"user_roles">> = {}
): Tables<"user_roles"> {
  return {
    id: "00000000-0000-4000-8000-000000000021",
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    user_id: ADMIN_USER_ID,
    role: "admin",
    permissions: [],
    status: "active",
    invited_by: null,
    invited_at: null,
    accepted_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

export function authUserFixture(overrides: Partial<{ id: string; email: string; phone: string | undefined }> = {}) {
  return {
    id: ADMIN_USER_ID,
    email: "admin.test@sadhanahostel.example",
    phone: "+91 90000 00001",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

export function publicUserInsertFixture(
  overrides: Partial<TablesInsert<"users">> = {}
): TablesInsert<"users"> {
  return {
    id: ADMIN_USER_ID,
    organization_id: TEST_ORGANIZATION_ID,
    full_name: "Admin User",
    email: "admin.test@sadhanahostel.example",
    phone: "+91 90000 00001",
    default_role: "admin",
    ...overrides,
  }
}
