import type { TablesInsert } from "@/types/database"

export const TEST_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001"
export const TEST_HOSTEL_ID = "00000000-0000-4000-8000-000000000002"
export const OTHER_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101"
export const OTHER_HOSTEL_ID = "00000000-0000-4000-8000-000000000102"

export function organizationFixture(
  overrides: Partial<TablesInsert<"organizations">> = {}
): TablesInsert<"organizations"> {
  return {
    id: TEST_ORGANIZATION_ID,
    name: "Sadhana Boys Hostel",
    legal_name: "Sadhana Boys Hostel",
    slug: "sadhana-boys-hostel-test",
    status: "active",
    country: "IN",
    is_active: true,
    settings: {},
    ...overrides,
  }
}

export function hostelFixture(
  overrides: Partial<TablesInsert<"hostels">> = {}
): TablesInsert<"hostels"> {
  return {
    id: TEST_HOSTEL_ID,
    organization_id: TEST_ORGANIZATION_ID,
    name: "Main Test Hostel",
    code: "SBH-TEST",
    slug: "main-test",
    capacity: 100,
    is_active: true,
    settings: {},
    ...overrides,
  }
}
