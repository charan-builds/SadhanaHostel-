import { logger } from "./logger"

export function logPaymentEvent(metadata: {
  action: "created" | "verification_attempted" | "verified" | "failed"
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
