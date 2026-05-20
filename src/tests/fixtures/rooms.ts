import type { Tables, TablesInsert } from "@/types/database"

import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "./organizations"
import { RESIDENT_ID } from "./residents"

export const ROOM_ID = "00000000-0000-4000-8000-000000000041"
export const ROOM_ALLOCATION_ID = "00000000-0000-4000-8000-000000000042"

export function roomFixture(overrides: Partial<Tables<"rooms">> = {}): Tables<"rooms"> {
  return {
    id: ROOM_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    room_number: "101",
    room_name: "Student Shared Room",
    room_type: "student_shared",
    floor: "1",
    block_name: "Student Block",
    capacity: 2,
    base_monthly_fee: 6500,
    has_attached_bathroom: false,
    has_ac: false,
    status: "active",
    description: null,
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

export function roomAllocationFixture(
  overrides: Partial<Tables<"room_allocations">> = {}
): Tables<"room_allocations"> {
  return {
    id: ROOM_ALLOCATION_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    resident_id: RESIDENT_ID,
    room_id: ROOM_ID,
    bed_label: "A",
    allocated_from: "2026-01-01",
    allocated_to: null,
    status: "active",
    monthly_fee_amount: 6500,
    reason: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

export function roomInsertFixture(
  overrides: Partial<TablesInsert<"rooms">> = {}
): TablesInsert<"rooms"> {
  return {
    id: ROOM_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    room_number: "101",
    capacity: 2,
    ...overrides,
  }
}
