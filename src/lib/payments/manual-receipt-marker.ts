const MANUAL_PAYMENT_RECEIPT_MARKER_PNG = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
  0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
  120, 156, 99, 248, 15, 4, 0, 9, 251, 3, 253, 167, 246, 129, 37, 0, 0, 0, 0,
  73, 69, 78, 68, 174, 66, 96, 130,
])

export function createManualPaymentReceiptMarker(paymentId: string) {
  return new File(
    [MANUAL_PAYMENT_RECEIPT_MARKER_PNG],
    `manual-payment-receipt-${paymentId}.png`,
    { type: "image/png" }
  )
}
