import { logger } from "./logger"

export function logPaymentEvent(metadata: {
  action:
    | "created"
    | "submitted_with_proof"
    | "verification_attempted"
    | "verified"
    | "verified_payment_reconciled"
    | "failed"
    | "rejected"
    | "payment_settings_saved"
    | "payment_qr_uploaded"
  paymentId?: string
  residentId?: string
  organizationId?: string
  actorUserId?: string
  amount?: number
  status?: string
  details?: Record<string, unknown>
}) {
  logger.info({
    event: `payment.${metadata.action}`,
    message: `Payment ${metadata.action}.`,
    userId: metadata.actorUserId,
    organizationId: metadata.organizationId,
    metadata,
  })
}
