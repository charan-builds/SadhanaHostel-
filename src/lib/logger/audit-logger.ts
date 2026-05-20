import { logger } from "./logger"

export function logAuditEvent(metadata: {
  action: string
  actorUserId?: string | null
  organizationId?: string | null
  targetTable?: string
  targetId?: string
  outcome?: "success" | "failure"
  details?: Record<string, unknown>
}) {
  logger.info({
    event: "audit.event",
    message: "Audit event recorded.",
    userId: metadata.actorUserId,
    organizationId: metadata.organizationId,
    metadata,
  })
}

export function logOnboardingEvent(metadata: {
  actorUserId?: string | null
  organizationId?: string | null
  targetUserId?: string
  role?: string
  outcome: "success" | "failure"
}) {
  logAuditEvent({
    action: "onboarding",
    actorUserId: metadata.actorUserId,
    organizationId: metadata.organizationId,
    outcome: metadata.outcome,
    details: metadata,
  })
}
