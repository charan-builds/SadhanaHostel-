import "server-only"

import { ADMIN_PORTAL_ROLES } from "@/constants/auth"
import { getServerEnv, isPlaceholderEnvValue } from "@/config/env"
import { getLaunchConfigSnapshot } from "@/config/launch"
import { getMetricsSnapshot } from "@/lib/metrics"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AnalyticsRepository } from "@/repositories/analytics.repository"
import { OperationsRepository } from "@/repositories/operations.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type {
  LaunchDiagnostics,
  LaunchMetric,
  LaunchReadinessCheck,
} from "@/types/launch"

import { AuthService } from "./auth.service"
import {
  buildResidentLifecycleSummary,
  isResidentEligibleForBilling,
  isResidentEligibleForOccupancy,
} from "./analytics/operational-metrics"

export class LaunchReadinessService {
  private readonly authService: AuthService
  private readonly operationsRepository: OperationsRepository
  private readonly analyticsRepository: AnalyticsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.operationsRepository = new OperationsRepository(db)
    this.analyticsRepository = new AnalyticsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new LaunchReadinessService(db)
  }

  async getDiagnostics(input: { organizationId?: string; hostelId?: string | null }) {
    const context = await this.authService.requireRole(ADMIN_PORTAL_ROLES)
    const organizationId = input.organizationId ?? context.organizationId
    const hostelId = input.hostelId ?? context.hostelIds[0] ?? null

    if (!organizationId) {
      return {
        generatedAt: new Date().toISOString(),
        organizationId: "",
        hostelId,
        launchConfig: getLaunchConfigSnapshot(),
        checks: [
          {
            id: "tenant.setup",
            label: "Tenant setup",
            status: "fail",
            description: "This admin is not linked to an organization.",
            action: "Open the setup wizard before soft launch.",
          },
        ],
        metrics: [],
        runtimeMetrics: getMetricsSnapshot(),
      } satisfies LaunchDiagnostics
    }

    this.authService.requireHostelAccess(context, organizationId, hostelId)
    const generatedAt = new Date()

    const [
      envCheck,
      storageCheck,
      signedUrlCheck,
      observabilityCheck,
      cronFailures,
      supportOpen,
      residentLifecycleRows,
      invitedResidents,
      activatedInvites,
      pendingInvites,
      expiredInvites,
      onboardingPending,
      paymentsVerified,
      paymentsPending,
      paymentsRejected,
      activeAllocations,
      roomCapacity,
      pendingDuesRecords,
    ] = await Promise.all([
      this.checkEnv(),
      this.checkStorage(),
      this.checkSignedUrlConfig(),
      this.checkObservability(),
      this.operationsRepository.count("audit_logs", {
        organizationId,
        equals: { action: "job.failed" },
        gte: {
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
      }),
      this.operationsRepository.count("support_requests", {
        organizationId,
        hostelId,
        in: { status: ["open", "in_progress", "waiting_on_resident"] },
      }),
      this.analyticsRepository.listResidentLifecycleRows(organizationId, hostelId ?? undefined),
      this.operationsRepository.count("residents", {
        organizationId,
        hostelId,
        equals: { status: "draft" },
        deletedAtNull: true,
      }),
      this.operationsRepository.count("resident_invites", {
        organizationId,
        hostelId,
        equals: { status: "used" },
      }),
      this.analyticsRepository.countPendingInvites(
        organizationId,
        generatedAt.toISOString(),
        hostelId ?? undefined
      ),
      this.operationsRepository.count("resident_invites", {
        organizationId,
        hostelId,
        equals: { status: "expired" },
      }),
      this.operationsRepository.count("residents", {
        organizationId,
        hostelId,
        in: {
          onboarding_status: [
            "invited",
            "activated",
            "profile_incomplete",
            "documents_pending",
            "verification_pending",
            "rejected",
          ],
        },
        deletedAtNull: true,
      }),
      this.operationsRepository.count("payments", {
        organizationId,
        hostelId,
        equals: { status: "verified" },
        deletedAtNull: true,
      }),
      this.operationsRepository.count("payments", {
        organizationId,
        hostelId,
        in: { status: ["pending", "initiated"] },
        deletedAtNull: true,
      }),
      this.operationsRepository.count("payments", {
        organizationId,
        hostelId,
        in: { status: ["failed"] },
        deletedAtNull: true,
      }),
      this.analyticsRepository.listActiveRoomAllocationsForOccupancy(organizationId, hostelId ?? undefined),
      this.analyticsRepository.getRoomCapacity(organizationId, hostelId ?? undefined),
      this.analyticsRepository.listPendingDuesRecords(organizationId, hostelId ?? undefined),
    ])

    const launchConfig = getLaunchConfigSnapshot()
    const residentLifecycle = buildResidentLifecycleSummary(residentLifecycleRows)
    const occupancyEligibleResidentIds = new Set(
      residentLifecycleRows
        .filter(isResidentEligibleForOccupancy)
        .map((resident) => resident.id)
        .filter((residentId): residentId is string => Boolean(residentId))
    )
    const billingEligibleResidentIds = new Set(
      residentLifecycleRows
        .filter(isResidentEligibleForBilling)
        .map((resident) => resident.id)
        .filter((residentId): residentId is string => Boolean(residentId))
    )
    const activeResidents = residentLifecycle.activeResidents
    const onboardingVerified = residentLifecycle.verifiedResidents
    const capacity = activeAllocations.filter(
      (allocation) =>
        allocation.resident_id && occupancyEligibleResidentIds.has(allocation.resident_id)
    ).length
    const pendingDues = pendingDuesRecords
      .filter((record) => billingEligibleResidentIds.has(record.resident_id))
      .reduce((total, record) => total + record.balance_amount, 0)
    const activationRate = rate(activatedInvites, activatedInvites + pendingInvites + expiredInvites)
    const onboardingCompletionRate = rate(onboardingVerified, onboardingVerified + onboardingPending)
    const paymentSuccessRate = rate(paymentsVerified, paymentsVerified + paymentsPending + paymentsRejected)
    const occupancyRate = rate(capacity, roomCapacity)

    const checks: LaunchReadinessCheck[] = [
      envCheck,
      storageCheck,
      signedUrlCheck,
      observabilityCheck,
      {
        id: "cron.failures",
        label: "Cron failures",
        status: cronFailures > 0 ? "fail" : "pass",
        description:
          cronFailures > 0
            ? `${cronFailures} scheduled jobs failed in the last 24 hours.`
            : "No scheduled job failures were recorded in the last 24 hours.",
        action: cronFailures > 0 ? "Open Admin -> Operations -> Automation and review failed jobs." : undefined,
      },
      {
        id: "cron.safeguard",
        label: "Cron safeguard",
        status: launchConfig.safeguards.cronJobsEnabled ? "pass" : "warn",
        description: launchConfig.safeguards.cronJobsEnabled
          ? "Scheduled jobs are enabled."
          : "Scheduled jobs are disabled by CRON_JOBS_ENABLED=false.",
        action: launchConfig.safeguards.cronJobsEnabled
          ? undefined
          : "Enable cron jobs before staging UAT unless this is an intentional maintenance window.",
      },
      {
        id: "repair.safeguard",
        label: "Repair safeguard",
        status: launchConfig.safeguards.operationalRepairsEnabled ? "pass" : "warn",
        description: launchConfig.safeguards.operationalRepairsEnabled
          ? "Emergency repair execution is enabled."
          : "Emergency repair execution is disabled; dry runs still work.",
        action: launchConfig.safeguards.operationalRepairsEnabled
          ? undefined
          : "Enable OPERATIONAL_REPAIRS_ENABLED for staffed repair windows only.",
      },
      {
        id: "support.open",
        label: "Open support issues",
        status: supportOpen > 0 ? "warn" : "pass",
        description:
          supportOpen > 0
            ? `${supportOpen} unresolved support issues are open.`
            : "No unresolved operational support issues are open.",
        action: supportOpen > 0 ? "Open Admin -> Alerts and clear launch-blocking issues." : undefined,
      },
      {
        id: "maintenance.mode",
        label: "Maintenance mode",
        status: launchConfig.maintenance.enabled ? "warn" : "pass",
        description: launchConfig.maintenance.enabled
          ? "Maintenance mode is enabled and will block normal users."
          : "Maintenance mode is disabled.",
        action: launchConfig.maintenance.enabled ? "Disable maintenance mode before opening the pilot." : undefined,
      },
      {
        id: "support.contacts",
        label: "Support contacts",
        status:
          launchConfig.softLaunch.supportWhatsAppConfigured &&
          launchConfig.softLaunch.ownerEmailConfigured
            ? "pass"
            : "warn",
        description: "Launch support WhatsApp and owner email configuration is checked.",
        action:
          launchConfig.softLaunch.supportWhatsAppConfigured &&
          launchConfig.softLaunch.ownerEmailConfigured
            ? undefined
            : "Set LAUNCH_SUPPORT_WHATSAPP and LAUNCH_OWNER_EMAIL in staging/production.",
      },
    ]

    const metrics: LaunchMetric[] = [
      {
        label: "Activation rate",
        value: activationRate,
        unit: "%",
        target: ">= 80% during pilot",
        status: activationRate >= 80 || invitedResidents === 0 ? "pass" : "warn",
      },
      {
        label: "Onboarding completion",
        value: onboardingCompletionRate,
        unit: "%",
        target: ">= 80% before broad rollout",
        status: onboardingCompletionRate >= 80 || activeResidents === 0 ? "pass" : "warn",
      },
      {
        label: "Payment success",
        value: paymentSuccessRate,
        unit: "%",
        target: ">= 90% verified/manual success",
        status: paymentSuccessRate >= 90 || paymentsVerified + paymentsPending + paymentsRejected === 0 ? "pass" : "warn",
      },
      {
        label: "Occupancy health",
        value: occupancyRate,
        unit: "%",
        target: "Track against owner target",
        status: occupancyRate >= 70 ? "pass" : "warn",
      },
      {
        label: "Pending dues",
        value: pendingDues,
        unit: "INR",
        target: "Review daily",
        status: pendingDues > 0 ? "warn" : "pass",
      },
    ]

    return {
      generatedAt: generatedAt.toISOString(),
      organizationId,
      hostelId,
      launchConfig,
      checks,
      metrics,
      runtimeMetrics: getMetricsSnapshot(),
    } satisfies LaunchDiagnostics
  }

  async getLaunchMetrics(input: { organizationId?: string; hostelId?: string | null }) {
    const diagnostics = await this.getDiagnostics(input)

    return {
      generatedAt: diagnostics.generatedAt,
      organizationId: diagnostics.organizationId,
      hostelId: diagnostics.hostelId,
      metrics: diagnostics.metrics,
    }
  }

  private async checkEnv(): Promise<LaunchReadinessCheck> {
    try {
      const env = getServerEnv()
      const launchMode = env.LAUNCH_MODE || env.NEXT_PUBLIC_LAUNCH_MODE
      const productionLike = launchMode === "staging" || launchMode === "soft_launch" || launchMode === "production"
      const placeholderNames = [
        "NEXT_PUBLIC_APP_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "CRON_SECRET",
        "INVITE_TOKEN_SECRET",
        "UPSTASH_REDIS_REST_TOKEN",
        "SENTRY_DSN",
        "SENTRY_AUTH_TOKEN",
        "RESEND_API_KEY",
      ].filter((name) => {
        const value = process.env[name]

        return value ? isPlaceholderEnvValue(value) : false
      })
      const publicSecretKeys = Object.keys(process.env).filter(
        (key) =>
          key.startsWith("NEXT_PUBLIC_") &&
          /(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD|TOKEN|AUTH_TOKEN|RESEND|CRON|DATABASE_URL)/i.test(key) &&
          Boolean(process.env[key]?.trim())
      )
      const missingOptional = [
        env.CRON_SECRET || !productionLike ? null : "CRON_SECRET",
        env.INVITE_TOKEN_SECRET || !productionLike ? null : "INVITE_TOKEN_SECRET",
        env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? null : "UPSTASH_REDIS",
      ].filter(Boolean)
      const appUrlLocalhost =
        productionLike &&
        ["localhost", "127.0.0.1", "0.0.0.0"].some((host) =>
          env.NEXT_PUBLIC_APP_URL.includes(host)
        )

      if (placeholderNames.length > 0 || publicSecretKeys.length > 0 || appUrlLocalhost) {
        return {
          id: "env.runtime",
          label: "Runtime environment",
          status: "fail",
          description: [
            placeholderNames.length > 0
              ? `Placeholder env values detected: ${placeholderNames.join(", ")}.`
              : null,
            publicSecretKeys.length > 0
              ? `Secret-like keys exposed to the browser: ${publicSecretKeys.join(", ")}.`
              : null,
            appUrlLocalhost ? "Launch mode is production-like but app URL points at localhost." : null,
          ]
            .filter(Boolean)
            .join(" "),
          action: "Replace placeholders, remove NEXT_PUBLIC_ secret exposure, and redeploy before UAT.",
        }
      }

      return {
        id: "env.runtime",
        label: "Runtime environment",
        status: missingOptional.length > 0 ? "warn" : "pass",
        description:
          missingOptional.length > 0
            ? `Core env is valid. Optional launch hardening missing: ${missingOptional.join(", ")}.`
            : "Runtime environment is valid and launch hardening values are configured.",
        action: missingOptional.length > 0 ? "Configure missing values before production cutover." : undefined,
      }
    } catch {
      return {
        id: "env.runtime",
        label: "Runtime environment",
        status: "fail",
        description: "Critical runtime environment validation failed.",
        action: "Fix environment variables before any launch traffic is allowed.",
      }
    }
  }

  private async checkStorage(): Promise<LaunchReadinessCheck> {
    const expectedBuckets = [
      "resident-documents",
      "payment-screenshots",
      "gallery-images",
      "invoices",
    ]

    try {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.storage.listBuckets()

      if (error) {
        throw error
      }

      const bucketNames = new Set((data ?? []).map((bucket) => bucket.name))
      const missing = expectedBuckets.filter((bucket) => !bucketNames.has(bucket))
      const sensitiveBuckets = new Set(["resident-documents", "payment-screenshots", "invoices"])
      const publicSensitiveBuckets = (data ?? [])
        .filter((bucket) => sensitiveBuckets.has(bucket.name) && bucket.public)
        .map((bucket) => bucket.name)

      return {
        id: "storage.buckets",
        label: "Storage isolation",
        status: missing.length > 0 || publicSensitiveBuckets.length > 0 ? "fail" : "pass",
        description:
          missing.length > 0
            ? `Missing storage buckets: ${missing.join(", ")}.`
            : publicSensitiveBuckets.length > 0
              ? `Sensitive buckets are public: ${publicSensitiveBuckets.join(", ")}.`
            : "Required private storage buckets are present.",
        action:
          missing.length > 0
            ? "Run storage setup migrations before staging UAT."
            : publicSensitiveBuckets.length > 0
              ? "Set sensitive buckets to private and rely on signed URLs."
              : undefined,
      }
    } catch {
      return {
        id: "storage.buckets",
        label: "Storage isolation",
        status: "fail",
        description: "Storage bucket validation failed.",
        action: "Check Supabase storage credentials and bucket policies.",
      }
    }
  }

  private async checkSignedUrlConfig(): Promise<LaunchReadinessCheck> {
    try {
      const env = getServerEnv()
      const ttl = env.STORAGE_SIGNED_URL_TTL_SECONDS

      if (ttl < 60 || ttl > 3600) {
        return {
          id: "storage.signed_urls",
          label: "Signed URL expiry",
          status: "warn",
          description: `Storage signed URL TTL is ${ttl} seconds. Use 60-3600 seconds for operational previews.`,
          action: "Set STORAGE_SIGNED_URL_TTL_SECONDS to a short staging/prod value such as 900.",
        }
      }

      return {
        id: "storage.signed_urls",
        label: "Signed URL expiry",
        status: "pass",
        description: `Storage signed URLs expire after ${ttl} seconds.`,
      }
    } catch {
      return {
        id: "storage.signed_urls",
        label: "Signed URL expiry",
        status: "fail",
        description: "Signed URL configuration could not be validated.",
        action: "Fix runtime environment before validating uploads and QR previews.",
      }
    }
  }

  private async checkObservability(): Promise<LaunchReadinessCheck> {
    const mode = process.env.LAUNCH_MODE ?? process.env.NEXT_PUBLIC_LAUNCH_MODE ?? "local"
    const productionLike = mode === "staging" || mode === "soft_launch" || mode === "production"
    const missing = [
      process.env.SENTRY_DSN ? null : "SENTRY_DSN",
      process.env.NEXT_PUBLIC_SENTRY_DSN ? null : "NEXT_PUBLIC_SENTRY_DSN",
      process.env.SENTRY_ENVIRONMENT ? null : "SENTRY_ENVIRONMENT",
    ].filter(Boolean)
    const sourceMapsRequested = process.env.SENTRY_UPLOAD_SOURCE_MAPS === "true"
    const sourceMapCredentialsMissing =
      sourceMapsRequested &&
      (!process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT || !process.env.SENTRY_AUTH_TOKEN)

    if (sourceMapCredentialsMissing) {
      return {
        id: "observability.sentry",
        label: "Sentry observability",
        status: "fail",
        description: "Sentry source-map upload is enabled but build credentials are incomplete.",
        action: "Set SENTRY_ORG, SENTRY_PROJECT, and SENTRY_AUTH_TOKEN or disable source-map upload.",
      }
    }

    if (productionLike && missing.length > 0) {
      return {
        id: "observability.sentry",
        label: "Sentry observability",
        status: "warn",
        description: `Sentry runtime values are incomplete: ${missing.join(", ")}.`,
        action: "Configure Sentry before staging UAT crash, trace, and replay validation.",
      }
    }

    return {
      id: "observability.sentry",
      label: "Sentry observability",
      status: "pass",
      description: sourceMapsRequested
        ? "Sentry runtime configuration and source-map upload credentials are configured."
        : "Sentry runtime configuration is present; source-map upload is disabled for this environment.",
    }
  }
}

function rate(value: number, total: number) {
  if (total <= 0) {
    return 0
  }

  return Number(((value / total) * 100).toFixed(2))
}
