import type { Tables, TablesInsert } from "@/types/database"

import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "./organizations"
import { RESIDENT_USER_ID } from "./users"

export const RESIDENT_ID = "00000000-0000-4000-8000-000000000031"
export const OTHER_RESIDENT_ID = "00000000-0000-4000-8000-000000000131"

export function residentFixture(
  overrides: Partial<Tables<"residents">> = {}
): Tables<"residents"> {
  return {
    id: RESIDENT_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    user_id: RESIDENT_USER_ID,
    parent_user_id: null,
    resident_type: "student",
    admission_number: "SBH-T-001",
    full_name: "Resident User",
    preferred_name: null,
    gender: "male",
    date_of_birth: null,
    phone: "+91 90000 00002",
    email: "resident.test@sadhanahostel.example",
    aadhaar_last4: null,
    aadhaar_document_id: null,
    profile_image_document_id: null,
    parent_name: "Parent User",
    parent_phone: "+91 90000 00003",
    parent_email: null,
    emergency_contact_name: "Emergency Contact",
    emergency_contact_phone: "+91 90000 00004",
    permanent_address: null,
    joined_on: "2026-01-01",
    checkout_on: null,
    monthly_fee_amount: 6500,
    security_deposit_amount: 5000,
    status: "active",
    notes: null,
    metadata: {},
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

export function residentInsertFixture(
  overrides: Partial<TablesInsert<"residents">> = {}
): TablesInsert<"residents"> {
  return {
    id: RESIDENT_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    admission_number: "SBH-T-001",
    full_name: "Resident User",
    resident_type: "student",
    status: "active",
    ...overrides,
  }
}
