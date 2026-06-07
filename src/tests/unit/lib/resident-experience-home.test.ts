import { describe, expect, it } from "vitest"

import {
  buildResidentHomeExperience,
  calculateResidentProfileCompletion,
} from "@/lib/resident-experience/home"
import type { Tables } from "@/types/database"
import type { NoticeWithEngagement } from "@/types/notices"
import type { ResidentPaymentLedger } from "@/types/payment-operations"
import type { CurrentResidentProfile } from "@/types/residents"

describe("resident home experience", () => {
  it("prioritizes due-tomorrow fees, notice acknowledgements, complaints, and profile gaps", () => {
    const experience = buildResidentHomeExperience({
      resident: resident({
        phone: null,
        email: null,
        parent_phone: null,
        emergency_contact_phone: "9999999999",
        permanent_address: "Pulivendula",
      }),
      ledger: ledger({
        totals: {
          currentDue: 5000,
          overdue: 0,
          pendingVerification: 0,
          verifiedPaid: 0,
          advanceBalance: 0,
        },
        primaryDueRecord: feeRecord({
          due_date: "2026-06-08",
          balance_amount: 5000,
        }),
      }),
      notices: [
        notice({
          id: "notice-1",
          title: "Hostel rules update",
          requires_acknowledgement: true,
          is_read: false,
          is_acknowledged: false,
        }),
      ],
      supportRequests: [
        supportRequest({
          id: "support-1",
          subject: "Bathroom tap leaking",
          status: "in_progress",
        }),
      ],
      leaves: [
        leaveRequest({
          id: "leave-1",
          status: "pending",
        }),
      ],
      today: new Date("2026-06-07T12:00:00.000Z"),
    })

    expect(experience.actions.map((action) => action.id)).toEqual([
      "payment-due-tomorrow",
      "notice-notice-1",
      "profile-incomplete",
      "support-support-1",
      "leave-leave-1",
    ])
    expect(experience.counts).toMatchObject({
      currentDue: 5000,
      acknowledgementPending: 1,
      openComplaints: 1,
      pendingLeaves: 1,
    })
    expect(experience.health.label).toBe("At risk")
    expect(experience.health.missingProfileFields).toEqual([
      "phone",
      "email",
      "parent phone",
    ])
  })

  it("builds a resident timeline from notices, payments, complaints, leaves, and room assignment", () => {
    const experience = buildResidentHomeExperience({
      resident: resident({
        current_room_allocation_id: "allocation-1",
        current_room_number: "101",
        current_bed_label: "A",
        joined_on: "2026-06-01",
      }),
      ledger: ledger({
        payments: [
          payment({
            id: "payment-1",
            status: "verified",
            amount: 5000,
            verified_at: "2026-06-05T10:00:00.000Z",
          }),
        ],
      }),
      notices: [
        notice({
          id: "notice-1",
          title: "Mess timing",
          is_read: true,
          is_acknowledged: false,
          published_at: "2026-06-06T09:00:00.000Z",
        }),
      ],
      supportRequests: [
        supportRequest({
          id: "support-1",
          status: "resolved",
          subject: "Fan repair",
          resolved_at: "2026-06-04T12:00:00.000Z",
        }),
      ],
      leaves: [
        leaveRequest({
          id: "leave-1",
          status: "approved",
          reviewed_at: "2026-06-03T08:00:00.000Z",
        }),
      ],
    })

    expect(experience.timeline.map((event) => event.title)).toEqual([
      "Notice read",
      "Payment verified",
      "Complaint resolved",
      "Leave approved",
      "Room assignment active",
    ])
    expect(experience.timeline.at(-1)).toMatchObject({
      type: "room",
      description: "Room 101 · Bed A",
    })
  })

  it("reports complete resident profiles at 100 percent", () => {
    expect(calculateResidentProfileCompletion(resident()).percentage).toBe(100)
  })
})

function resident(
  overrides: Partial<CurrentResidentProfile> = {}
): CurrentResidentProfile {
  return {
    aadhaar_document_id: null,
    aadhaar_last4: null,
    admission_number: "ADM-001",
    checkout_on: null,
    created_at: "2026-06-01T00:00:00.000Z",
    created_by: null,
    date_of_birth: null,
    deleted_at: null,
    deleted_by: null,
    email: "resident@example.com",
    emergency_contact_name: null,
    emergency_contact_phone: "8888888888",
    full_name: "Test Resident",
    gender: null,
    hostel_id: "hostel-1",
    id: "resident-1",
    is_active: true,
    joined_on: "2026-06-01",
    metadata: {},
    monthly_fee_amount: 5000,
    notes: null,
    organization_id: "org-1",
    parent_email: null,
    parent_name: null,
    parent_phone: "7777777777",
    parent_user_id: null,
    permanent_address: "Pulivendula",
    phone: "9999999999",
    preferred_name: "Resident",
    profile_image_document_id: null,
    resident_type: "student",
    security_deposit_amount: 5000,
    status: "active",
    updated_at: "2026-06-01T00:00:00.000Z",
    updated_by: null,
    user_id: "user-1",
    current_room_allocation_id: null,
    current_room_number: null,
    current_room_name: null,
    current_bed_label: null,
    ...overrides,
  }
}

function ledger(
  overrides: Partial<ResidentPaymentLedger> = {}
): ResidentPaymentLedger {
  return {
    resident: {
      id: "resident-1",
      full_name: "Test Resident",
      hostel_id: "hostel-1",
      monthly_fee_amount: 5000,
      joined_on: "2026-06-01",
    },
    totals: {
      currentDue: 0,
      overdue: 0,
      pendingVerification: 0,
      verifiedPaid: 5000,
      advanceBalance: 0,
    },
    billing: {
      joinedOn: "2026-06-01",
      currentPeriodMonth: "2026-06-01",
      currentDueDate: "2026-06-08",
      nextDueDate: "2026-07-08",
      generatedCurrentDue: false,
    },
    primaryDueRecord: null,
    feeRecords: [],
    payments: [],
    invoices: [],
    ...overrides,
  }
}

function feeRecord(
  overrides: Partial<Tables<"monthly_fee_records">> = {}
): Tables<"monthly_fee_records"> {
  return {
    adjustment_amount: 0,
    advance_adjustment_amount: 0,
    balance_amount: 0,
    base_amount: 5000,
    created_at: "2026-06-01T00:00:00.000Z",
    created_by: null,
    deleted_at: null,
    deleted_by: null,
    discount_amount: 0,
    due_date: "2026-06-08",
    generated_at: "2026-06-01T00:00:00.000Z",
    hostel_id: "hostel-1",
    id: "fee-1",
    is_active: true,
    metadata: {},
    notes: null,
    organization_id: "org-1",
    paid_amount: 0,
    penalty_amount: 0,
    period_month: "2026-06-01",
    resident_id: "resident-1",
    room_allocation_id: null,
    status: "pending",
    total_amount: 5000,
    updated_at: "2026-06-01T00:00:00.000Z",
    updated_by: null,
    ...overrides,
  }
}

function payment(overrides: Partial<Tables<"payments">> = {}): Tables<"payments"> {
  return {
    amount: 5000,
    cashfree_order_id: null,
    cashfree_payment_id: null,
    created_at: "2026-06-02T00:00:00.000Z",
    created_by: null,
    deleted_at: null,
    deleted_by: null,
    failure_reason: null,
    hostel_id: "hostel-1",
    id: "payment-1",
    idempotency_key: null,
    invoice_finalization_attempts: 0,
    invoice_finalization_error: null,
    invoice_finalization_status: "pending",
    invoice_finalized_at: null,
    invoice_id: null,
    is_active: true,
    is_advance: false,
    is_partial: false,
    lock_version: 0,
    manual_reference: null,
    metadata: {},
    method: "upi",
    monthly_fee_record_id: null,
    notes: null,
    organization_id: "org-1",
    paid_at: "2026-06-02T00:00:00.000Z",
    provider: null,
    provider_reference: null,
    received_by: null,
    resident_id: "resident-1",
    status: "pending",
    transaction_id: "UPI123456",
    updated_at: "2026-06-02T00:00:00.000Z",
    updated_by: null,
    verified_at: null,
    verified_by: null,
    ...overrides,
  }
}

function notice(overrides: Partial<NoticeWithEngagement> = {}): NoticeWithEngagement {
  return {
    audience_filter: {},
    audience_type: "all",
    body: "Notice body",
    created_at: "2026-06-01T00:00:00.000Z",
    created_by: null,
    deleted_at: null,
    deleted_by: null,
    expires_at: null,
    hostel_id: "hostel-1",
    id: "notice-1",
    is_active: true,
    is_pinned: false,
    notice_type: "general",
    organization_id: "org-1",
    published_at: "2026-06-01T00:00:00.000Z",
    published_by: null,
    requires_acknowledgement: false,
    status: "published",
    title: "Notice",
    updated_at: "2026-06-01T00:00:00.000Z",
    updated_by: null,
    total_recipients: 1,
    read_count: 1,
    unread_count: 0,
    read_percentage: 100,
    acknowledgement_count: 0,
    pending_count: 0,
    acknowledgement_percentage: 100,
    is_read: true,
    is_acknowledged: false,
    notification_id: null,
    ...overrides,
  }
}

function supportRequest(
  overrides: Partial<Tables<"support_requests">> = {}
): Tables<"support_requests"> {
  return {
    assigned_to_user_id: null,
    category: "maintenance",
    closed_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
    created_by: null,
    created_by_user_id: "user-1",
    deleted_at: null,
    deleted_by: null,
    description: "Support request",
    hostel_id: "hostel-1",
    id: "support-1",
    is_active: true,
    metadata: {},
    organization_id: "org-1",
    priority: "medium",
    resident_id: "resident-1",
    resolution_notes: null,
    resolved_at: null,
    status: "open",
    subject: "Support request",
    updated_at: "2026-06-01T00:00:00.000Z",
    updated_by: null,
    ...overrides,
  }
}

function leaveRequest(
  overrides: Partial<Tables<"leave_requests">> = {}
): Tables<"leave_requests"> {
  return {
    created_at: "2026-06-01T00:00:00.000Z",
    created_by: null,
    deleted_at: null,
    deleted_by: null,
    departed_at: null,
    destination: null,
    from_date: "2026-06-10",
    hostel_id: "hostel-1",
    id: "leave-1",
    is_active: true,
    metadata: {},
    notes: null,
    organization_id: "org-1",
    parent_notified_at: null,
    reason: "Home visit",
    rejection_reason: null,
    resident_id: "resident-1",
    returned_at: null,
    reviewed_at: null,
    reviewed_by: null,
    status: "pending",
    to_date: "2026-06-12",
    travel_mode: "Bus",
    updated_at: "2026-06-01T00:00:00.000Z",
    updated_by: null,
    ...overrides,
  }
}
