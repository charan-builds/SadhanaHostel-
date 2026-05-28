import "server-only"

import { databaseError, forbidden } from "@/lib/api/api-error"
import { logger } from "@/lib/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AuthService } from "@/services/auth.service"
import type {
  DemoDataResetAuthUser,
  DemoDataResetReport,
  DemoDataResetStorageObject,
} from "@/types/operations"
import { demoDataResetSchema } from "@/validations/operations.validation"

import { IdentityReconciliationService } from "./identity-reconciliation.service"

type ResetRpcClient = {
  rpc(
    functionName: "reset_resident_operational_data_for_staging",
    args: {
      p_organization_id: string
      p_hostel_id: string | null
      p_actor_user_id: string
      p_dry_run: boolean
      p_confirmation: string | null
    }
  ): Promise<{ data: unknown; error: { message: string; code?: string } | null }>
}

type AuditInsertClient = {
  from(table: "audit_logs"): {
    insert(values: Record<string, unknown>): Promise<{ error: { message: string } | null }>
  }
}

export class DemoDataResetService {
  constructor(
    private readonly authService: AuthService,
    private readonly adminDb = createSupabaseAdminClient()
  ) {}

  static async create() {
    const db = await createSupabaseServerClient()

    return new DemoDataResetService(new AuthService(db))
  }

  async reset(input: unknown): Promise<DemoDataResetReport> {
    const values = demoDataResetSchema.parse(input)
    const context = await this.authService.requireRole(["owner", "super_admin"])

    this.authService.requireHostelAccess(
      context,
      values.organizationId,
      values.hostelId
    )

    if (!context.roles.some((role) => role === "owner" || role === "super_admin")) {
      throw forbidden("Only hostel owners can reset demo/test operational data.")
    }

    const { data, error } = await (this.adminDb as unknown as ResetRpcClient).rpc(
      "reset_resident_operational_data_for_staging",
      {
        p_organization_id: values.organizationId,
        p_hostel_id: values.hostelId ?? null,
        p_actor_user_id: context.authUser.id,
        p_dry_run: values.dryRun,
        p_confirmation: values.confirmation ?? null,
      }
    )

    if (error) {
      logger.error({
        event: "demo_data_reset.rpc_failed",
        message: "Demo/test reset RPC failed.",
        organizationId: values.organizationId,
        metadata: {
          code: error.code,
        },
      })
      throw databaseError("Demo/test data reset failed.")
    }

    const report = normalizeResetReport(data)
    const identityReconciliation = new IdentityReconciliationService(
      this.authService,
      this.adminDb
    )
    const authCleanupPlan =
      await identityReconciliation.prepareAuthCleanupForReset(report)
    const reportWithAuthPlan: DemoDataResetReport = {
      ...report,
      authUsers: authCleanupPlan.authUsers,
      warnings: [...report.warnings, ...authCleanupPlan.warnings],
    }

    if (reportWithAuthPlan.dryRun) {
      return reportWithAuthPlan
    }

    const externalCleanup = await this.cleanupExternalState(reportWithAuthPlan)
    const authCleanup =
      await identityReconciliation.deleteAuthUsersForReset(reportWithAuthPlan)
    const finalReport: DemoDataResetReport = {
      ...reportWithAuthPlan,
      storageDeleted: externalCleanup.storageDeleted,
      authUsersDeleted: authCleanup.authUsersDeleted,
      warnings: [
        ...reportWithAuthPlan.warnings,
        ...externalCleanup.warnings,
        ...authCleanup.warnings,
      ],
    }

    await this.recordExternalCleanupAudit(finalReport, context.authUser.id)

    return finalReport
  }

  private async cleanupExternalState(report: DemoDataResetReport) {
    const warnings: string[] = []
    let storageDeleted = 0

    const storageByBucket = groupStorageObjects(report.storageObjects)

    for (const [bucket, paths] of storageByBucket) {
      for (const chunk of chunkArray(paths, 100)) {
        const { data, error } = await this.adminDb.storage.from(bucket).remove(chunk)

        if (error) {
          warnings.push(
            `Storage cleanup failed for ${bucket}: ${error.message}. Re-run the reset after checking the bucket.`
          )
          logger.warn({
            event: "demo_data_reset.storage_cleanup_failed",
            message: "Demo/test reset could not remove one storage chunk.",
            organizationId: report.organizationId,
            metadata: {
              bucket,
              objectCount: chunk.length,
            },
          })
          continue
        }

        storageDeleted += data?.length ?? chunk.length
      }
    }

    return {
      storageDeleted,
      warnings,
    }
  }

  private async recordExternalCleanupAudit(
    report: DemoDataResetReport,
    actorUserId: string
  ) {
    const { error } = await (this.adminDb as unknown as AuditInsertClient)
      .from("audit_logs")
      .insert({
        organization_id: report.organizationId,
        hostel_id: report.hostelId ?? null,
        actor_user_id: actorUserId,
        table_name: "staging_demo_data_reset",
        record_id: report.auditId ?? null,
        action: "demo_data_reset.external_cleanup",
        old_values: null,
        new_values: {
          storageDeleted: report.storageDeleted ?? 0,
          authUsersDeleted: report.authUsersDeleted ?? 0,
        },
        metadata: {
          warnings: report.warnings,
          plannedStorageObjects: report.storageObjects.length,
          plannedAuthUsers: report.authUsers.length,
          databaseAuditId: report.auditId ?? null,
        },
      })

    if (error) {
      logger.warn({
        event: "demo_data_reset.audit_failed",
        message: "Demo/test reset external cleanup audit could not be written.",
        organizationId: report.organizationId,
        metadata: {
          error: error.message,
          databaseAuditId: report.auditId,
        },
      })
    }
  }
}

function normalizeResetReport(value: unknown): DemoDataResetReport {
  const record = isRecord(value) ? value : {}

  return {
    dryRun: Boolean(record.dryRun ?? true),
    organizationId: stringValue(record.organizationId),
    hostelId: nullableString(record.hostelId),
    rows: numberRecord(record.rows),
    deletedRows: numberRecord(record.deletedRows),
    authUsers: authUsers(record.authUsers),
    storageObjects: storageObjects(record.storageObjects),
    preserved: stringArray(record.preserved),
    warnings: stringArray(record.warnings),
    confirmationRequired: stringValue(record.confirmationRequired, "RESET DEMO DATA"),
    sequencesReset: stringArray(record.sequencesReset),
    auditId: nullableString(record.auditId),
    executedAt: nullableString(record.executedAt),
  }
}

function authUsers(value: unknown): DemoDataResetAuthUser[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map((entry) => ({
    id: stringValue(entry.id),
    email: nullableString(entry.email),
    phone: nullableString(entry.phone),
    reason: stringValue(entry.reason, "resident/test auth user"),
  })).filter((entry) => entry.id)
}

function storageObjects(value: unknown): DemoDataResetStorageObject[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map((entry) => ({
    bucket: stringValue(entry.bucket),
    path: stringValue(entry.path),
    sourceTable: nullableString(entry.sourceTable),
    recordId: nullableString(entry.recordId),
  })).filter((entry) => entry.bucket && entry.path)
}

function groupStorageObjects(objects: DemoDataResetStorageObject[]) {
  const grouped = new Map<string, string[]>()

  objects.forEach((object) => {
    const paths = grouped.get(object.bucket) ?? []

    paths.push(object.path)
    grouped.set(object.bucket, paths)
  })

  return grouped
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function numberRecord(value: unknown) {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      typeof entryValue === "number" ? entryValue : Number(entryValue ?? 0) || 0,
    ])
  )
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === "string")
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
