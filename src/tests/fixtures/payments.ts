import type { Tables, TablesInsert } from "@/types/database"

import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "./organizations"
import { RESIDENT_ID } from "./residents"

export const PAYMENT_ID = "00000000-0000-4000-8000-000000000051"
export const FEE_RECORD_ID = "00000000-0000-4000-8000-000000000052"

export function paymentFixture(
  overrides: Partial<Tables<"payments">> = {}
): Tables<"payments"> {
  return {
    id: PAYMENT_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    resident_id: RESIDENT_ID,
    monthly_fee_record_id: null,
    invoice_id: null,
    amount: 6500,
    method: "upi",
    status: "pending",
    transaction_id: "UPI-TXN-001",
    provider: "upi",
    provider_reference: null,
    cashfree_order_id: null,
    cashfree_payment_id: null,
    manual_reference: null,
    notes: null,
    is_advance: false,
    is_partial: false,
    paid_at: null,
    received_by: null,
    verified_by: null,
    verified_at: null,
    failure_reason: null,
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

export function paymentInsertFixture(
  overrides: Partial<TablesInsert<"payments">> = {}
): TablesInsert<"payments"> {
  return {
    id: PAYMENT_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    resident_id: RESIDENT_ID,
    amount: 6500,
    method: "upi",
    status: "pending",
    ...overrides,
  }
}
