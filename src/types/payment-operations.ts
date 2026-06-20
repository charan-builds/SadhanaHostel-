import type { Json, Tables } from "@/types/database"

export type ManualPaymentMethod = "upi" | "bank_transfer" | "cash"

export type PaymentSettingRow = {
  id: string
  organization_id: string
  hostel_id: string
  payment_method: ManualPaymentMethod
  account_name: string
  upi_id: string | null
  qr_image_path: string | null
  bank_name: string | null
  branch_name: string | null
  account_last4: string | null
  is_active: boolean
  supports_manual_verification: boolean
  instructions: string | null
  require_utr: boolean
  require_screenshot: boolean
  allow_partial_payment: boolean
  allow_advance_payment: boolean
  auto_expire_pending_payments: boolean
  min_payment_amount: number
  utr_regex: string
  duplicate_detection_strictness: "standard" | "strict"
  version: number
  rotated_from_setting_id: string | null
  activated_at: string | null
  deactivated_at: string | null
  qr_version: number
  qr_replaced_at: string | null
  metadata: Json
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export type PaymentSettingView = PaymentSettingRow & {
  qrImageSignedUrl: string | null
  qrImageSignedUrlExpiresAt: string | null
  qrImagePreviewError: string | null
}

export type PaymentSettingTestResult = {
  status: "pass" | "warning" | "fail"
  checks: Array<{
    key: string
    label: string
    status: "pass" | "warning" | "fail"
    message: string
  }>
}

export type PaymentQrUploadResult = {
  bucketName: "payment-qr-codes"
  storagePath: string
  signedUrl: string
  expiresInSeconds: number
  signedUrlExpiresAt: string
}

export type ResidentPaymentLedger = {
  resident: Pick<
    Tables<"residents">,
    "id" | "full_name" | "hostel_id" | "monthly_fee_amount" | "joined_on"
  >
  totals: {
    currentDue: number
    overdue: number
    pendingVerification: number
    verifiedPaid: number
    advanceBalance: number
  }
  billing: {
    joinedOn: string | null
    currentPeriodMonth: string
    currentDueDate: string | null
    nextDueDate: string | null
    generatedCurrentDue: boolean
  }
  primaryDueRecord: Tables<"monthly_fee_records"> | null
  feeHistory?: Array<{
    id: string
    periodMonth: string
    amount: number
    source: "advance" | "payment"
    method: "advance" | "cash" | "upi" | "bank_transfer"
    paidAt: string
    status: "paid" | "partial"
  }>
  feeRecords: Tables<"monthly_fee_records">[]
  payments: Tables<"payments">[]
  invoices: Tables<"invoices">[]
}
