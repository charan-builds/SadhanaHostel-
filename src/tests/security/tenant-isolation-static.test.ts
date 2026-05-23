import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const migrationsDir = path.join(process.cwd(), "supabase", "migrations")
const srcDir = path.join(process.cwd(), "src")

function migration(name: string) {
  return readFileSync(path.join(migrationsDir, name), "utf8")
}

function combinedMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => migration(file))
    .join("\n")
}

function projectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      return listSourceFiles(fullPath)
    }

    return fullPath.endsWith(".ts") || fullPath.endsWith(".tsx") ? [fullPath] : []
  })
}

describe("tenant isolation and security hardening contracts", () => {
  it("forces RLS on tenant-sensitive tables, including late-added operations tables", () => {
    const sql = combinedMigrations()
    const sensitiveTables = [
      "residents",
      "payments",
      "invoices",
      "monthly_fee_records",
      "leave_requests",
      "documents",
      "room_allocations",
      "notifications",
      "audit_logs",
      "resident_invites",
      "reservations",
      "reservation_payments",
      "payment_settings",
      "hostel_capacity",
      "room_capacity",
      "leads",
      "lead_activity_logs",
    ]

    sensitiveTables.forEach((table) => {
      expect(sql).toMatch(
        new RegExp(
          `alter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${table}\\s+force\\s+row\\s+level\\s+security`,
          "i"
        )
      )
    })
  })

  it("keeps finance role support aligned between RLS helpers and API services", () => {
    const hardening = migration("20260523003000_security_tenant_isolation_hardening.sql")
    const paymentsService = projectFile("src/services/payments.service.ts")

    expect(hardening).toMatch(/array\['owner',\s*'admin',\s*'finance'\]/i)
    expect(paymentsService).toMatch(/async\s+verifyPayment[\s\S]*requireRole\(FINANCE_ROLES\)/)
    expect(paymentsService).toMatch(/async\s+rejectPayment[\s\S]*requireRole\(FINANCE_ROLES\)/)
  })

  it("enforces upload, payment, invite, and reservation tenant-scope invariants in the database", () => {
    const hardening = migration("20260523003000_security_tenant_isolation_hardening.sql")

    expect(hardening).toMatch(/documents_storage_path_tenant_prefix_chk/i)
    expect(hardening).toMatch(/validate_document_tenant_scope/i)
    expect(hardening).toMatch(/validate_payment_tenant_scope/i)
    expect(hardening).toMatch(/validate_resident_invite_tenant_scope/i)
    expect(hardening).toMatch(/validate_reservation_payment_tenant_scope/i)
    expect(hardening).toMatch(/security_anomalies_view/i)
  })

  it("authorizes private realtime topics by tenant and hostel scope", () => {
    const realtime = migration("20260523005000_realtime_tenant_authorization.sql")
    const provider = projectFile("src/lib/realtime/realtime-provider.tsx")
    const channelHook = projectFile("src/lib/realtime/use-realtime-channel.ts")
    const publisher = projectFile("src/services/realtime/event-publisher.ts")

    expect(realtime).toMatch(/on\s+realtime\.messages/i)
    expect(realtime).toMatch(/for\s+select\s+to\s+authenticated/i)
    expect(realtime).toMatch(/realtime\.topic\(\)/i)
    expect(realtime).toMatch(/realtime_topic_organization_id/i)
    expect(realtime).toMatch(/has_role_in_organization/i)
    expect(provider).toMatch(/tenant:\$\{organizationId\}:hostel:\$\{hostelId\}/)
    expect(channelHook).toMatch(/private:\s*true/)
    expect(publisher).toMatch(/private:\s*true/)
  })

  it("keeps private storage buckets private and tenant-scoped", () => {
    const sql = combinedMigrations()

    expect(sql).toMatch(/'resident-documents'[\s\S]*false[\s\S]*10485760/i)
    expect(sql).toMatch(/'payment-screenshots'[\s\S]*false[\s\S]*5242880/i)
    expect(sql).toMatch(/'payment-qr-codes'[\s\S]*false[\s\S]*2097152/i)
    expect(sql).toMatch(/'invoices'[\s\S]*false[\s\S]*10485760/i)
    expect(sql).toMatch(/storage_object_organization_id\(name\)/i)
    expect(sql).toMatch(/storage_object_resident_id\(name\)/i)
    expect(sql).toMatch(/storage_resident_read_own_documents/i)
    expect(sql).toMatch(/storage_admin_manage_payment_qr_codes/i)
  })

  it("keeps signed URL lifetimes bounded for private operational files", () => {
    const uploadValidation = projectFile("src/validations/upload.validation.ts")
    const invoiceValidation = projectFile("src/validations/invoice.validation.ts")
    const paymentsService = projectFile("src/services/payments.service.ts")
    const uploadsRepository = projectFile("src/repositories/uploads.repository.ts")
    const invoiceStorage = projectFile("src/services/invoices/invoice-storage.service.ts")

    expect(uploadValidation).toMatch(/expiresInSeconds[\s\S]*max\(3600\)[\s\S]*default\(900\)/)
    expect(invoiceValidation).toMatch(/expiresInSeconds[\s\S]*max\(3600\)[\s\S]*default\(900\)/)
    expect(paymentsService).toMatch(/createSignedUrl\(\s*"payment-qr-codes"[\s\S]*900\s*\)/)
    expect(uploadsRepository).toMatch(/Math\.min\([\s\S]*3600[\s\S]*createSignedUrl\(storagePath,\s*safeExpiresIn\)/)
    expect(invoiceStorage).toMatch(/Math\.min\([\s\S]*3600[\s\S]*safeExpiresInSeconds/)
  })

  it("keeps service-role clients server-only and out of client components", () => {
    const adminClient = projectFile("src/lib/supabase/admin.ts")
    const publicSupabaseBarrel = projectFile("src/lib/supabase/index.ts")
    const serviceSupabaseBarrel = projectFile("src/services/supabase/index.ts")
    const clientFilesWithPrivilegedImports = listSourceFiles(srcDir).filter((file) => {
      const source = readFileSync(file, "utf8")

      return (
        /^\s*["']use client["']/m.test(source) &&
        /createSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY|getSupabaseAdminConfig|serviceRoleKey/.test(
          source
        )
      )
    })

    expect(adminClient).toMatch(/import\s+"server-only"/)
    expect(publicSupabaseBarrel).not.toMatch(/createSupabaseAdminClient/)
    expect(serviceSupabaseBarrel).not.toMatch(/createSupabaseAdminClient/)
    expect(clientFilesWithPrivilegedImports).toEqual([])
  })

  it("uses service-role RPCs only after application-level role and tenant checks", () => {
    const authService = projectFile("src/services/auth.service.ts")
    const residentsService = projectFile("src/services/residents.service.ts")

    expect(authService).toMatch(
      /async\s+onboardResident[\s\S]*requireAdmin\(\)[\s\S]*requireOrganizationAccess[\s\S]*createSupabaseAdminClient\(\)[\s\S]*onboard_resident/
    )
    expect(authService).toMatch(
      /async\s+onboardAdmin[\s\S]*requireAdmin\(\)[\s\S]*requireOrganizationAccess[\s\S]*createSupabaseAdminClient\(\)[\s\S]*onboard_admin/
    )
    expect(residentsService).toMatch(
      /async\s+onboardResident[\s\S]*requireAdmin\(\)[\s\S]*requireOrganizationAccess[\s\S]*createSupabaseAdminClient\(\)\.rpc\("onboard_resident"/
    )
  })

  it("enforces explicit hostel scope on finance, analytics, exports, and automation surfaces", () => {
    const authService = projectFile("src/services/auth.service.ts")
    const paymentsService = projectFile("src/services/payments.service.ts")
    const analyticsService = projectFile("src/services/analytics.service.ts")
    const reportBuilder = projectFile("src/services/reports/report-builder.service.ts")
    const automationService = projectFile("src/services/operations/automation.service.ts")
    const consistencyService = projectFile("src/services/operations/consistency.service.ts")
    const jobsRoute = projectFile("src/app/api/v1/jobs/run/route.ts")

    expect(authService).toMatch(/requireHostelAccess\(/)
    expect(paymentsService).toMatch(/verifyPayment[\s\S]*requireHostelAccess/)
    expect(paymentsService).toMatch(/savePaymentSettings[\s\S]*requireHostelAccess/)
    expect(analyticsService).toMatch(/getOwnerDashboard[\s\S]*requireHostelAccess/)
    expect(reportBuilder).toMatch(/build[\s\S]*requireHostelAccess/)
    expect(automationService).toMatch(/run[\s\S]*requireHostelAccess/)
    expect(consistencyService).toMatch(/repair[\s\S]*requireHostelAccess/)
    expect(jobsRoute).toMatch(/requireHostelAccess\(context,\s*values\.organizationId,\s*values\.hostelId\)/)
    expect(jobsRoute).toMatch(/delete\s+safePayload\.organizationId/)
    expect(jobsRoute).toMatch(/delete\s+safePayload\.hostelId/)
  })

  it("keeps example environment files free of committed JWT secrets", () => {
    const envExamples = [".env.example", ".env.staging.example"]

    envExamples.forEach((file) => {
      const source = projectFile(file)

      expect(source).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)
      expect(source).not.toMatch(/service_role.*eyJ/i)
    })
  })
})
