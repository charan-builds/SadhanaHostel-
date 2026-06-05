import "server-only"

import {
  getProductionSafetySnapshot,
  type ProductionSafetySnapshot,
} from "@/config/production-safety"
import { forbidden } from "@/lib/api/api-error"

export type ProductionSafetyOperation =
  | "automation_destructive_job"
  | "automation_destructive_job_settings"
  | "consistency_repair"
  | "demo_data_reset"
  | "fake_resident_generation"
  | "identity_repair"
  | "resident_lifecycle_repair"
  | "sample_data_generation"
  | "staging_seed"
  | "staging_reset"
  | "test_payment_generation"

export function assertNonProductionOperation(
  operation: ProductionSafetyOperation,
  details?: { message?: string }
) {
  const snapshot = getProductionSafetySnapshot()

  if (!snapshot.production) {
    return snapshot
  }

  throw forbidden(details?.message ?? blockedMessage(operation, snapshot))
}

export function assertNonProductionMutation(
  operation: ProductionSafetyOperation,
  input: { dryRun?: boolean },
  details?: { message?: string }
) {
  if (input.dryRun) {
    return getProductionSafetySnapshot()
  }

  return assertNonProductionOperation(operation, details)
}

export function isProductionSafetyBlocked() {
  return getProductionSafetySnapshot().production
}

function blockedMessage(
  operation: ProductionSafetyOperation,
  snapshot: ProductionSafetySnapshot
) {
  return [
    `${humanizeOperation(operation)} is blocked in production.`,
    "This endpoint can only run in local or staging launch modes.",
    `LAUNCH_MODE=${snapshot.launchMode ?? "unset"}, NEXT_PUBLIC_LAUNCH_MODE=${snapshot.publicLaunchMode ?? "unset"}.`,
  ].join(" ")
}

function humanizeOperation(operation: ProductionSafetyOperation) {
  return operation.replace(/_/g, " ")
}
