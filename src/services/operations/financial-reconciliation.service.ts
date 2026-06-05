import "server-only"

import { areOperationalRepairsEnabled } from "@/config/launch"
import { createManualPaymentReceiptMarker } from "@/lib/payments/manual-receipt-marker"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { OperationsRepository } from "@/repositories/operations.repository"
import {
  FinancialReconciliationRepository,
  type AdvancePaymentInvoiceRepairResult,
  type FinancialReconciliationCounts,
  type MonthlyFeeInvoiceRepairResult,
  type ReceiptInvoiceLinkRepairResult,
} from "@/repositories/financial-reconciliation.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { UploadsRepository } from "@/repositories/uploads.repository"
import {
  financialReconciliationRepairSchema,
  type FinancialReconciliationRepairInput,
  missingReceiptRegenerationSchema,
} from "@/validations/operations.validation"

import { AuthService } from "../auth.service"
import { InvoicesService, type MissingInvoicePdfRepairResult } from "../invoices/invoice.service"

export type FinancialReconciliationRepairReport = {
  dryRun: boolean
  organizationId: string
  hostelId?: string | null
  before: FinancialReconciliationCounts
  after: FinancialReconciliationCounts
  repairs: {
    monthlyFeeInvoices?: MonthlyFeeInvoiceRepairResult
    advancePaymentInvoices?: AdvancePaymentInvoiceRepairResult
    receiptInvoiceLinks?: ReceiptInvoiceLinkRepairResult
    missingInvoicePdfs?: MissingInvoicePdfRepairResult
  }
  message: string
}

export type MissingReceiptRepairReport = {
  dryRun: boolean
  organizationId: string
  hostelId?: string | null
  before: FinancialReconciliationCounts
  after: FinancialReconciliationCounts
  candidates: number
  receiptsGenerated: number
  skippedExisting: number
  message: string
}

export class FinancialReconciliationService {
  private readonly authService: AuthService
  private readonly repository: FinancialReconciliationRepository
  private readonly uploadsRepository: UploadsRepository
  private readonly operationsRepository: OperationsRepository
  private readonly invoicesService: InvoicesService

  constructor(db: AppSupabaseClient, adminDb: AppSupabaseClient = db) {
    this.authService = new AuthService(db)
    this.repository = new FinancialReconciliationRepository(adminDb)
    this.uploadsRepository = new UploadsRepository(adminDb)
    this.operationsRepository = new OperationsRepository(adminDb)
    this.invoicesService = new InvoicesService(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new FinancialReconciliationService(db, createSupabaseAdminClient())
  }

  async getCounts(input: Pick<FinancialReconciliationRepairInput, "organizationId" | "hostelId">) {
    const context = await this.authService.requirePermission("finance.manage")

    this.authService.requireHostelAccess(context, input.organizationId, input.hostelId)

    return this.repository.getCounts({
      organizationId: input.organizationId,
      hostelId: input.hostelId ?? null,
    })
  }

  async repairMonthlyFeeInvoices(input: FinancialReconciliationRepairInput) {
    const values = financialReconciliationRepairSchema.parse({
      ...input,
      action: "repair_monthly_fee_invoices",
    })

    return this.repair(values)
  }

  async repairAdvancePaymentInvoices(input: FinancialReconciliationRepairInput) {
    const values = financialReconciliationRepairSchema.parse({
      ...input,
      action: "repair_advance_payment_invoices",
    })

    return this.repair(values)
  }

  async repairReceiptInvoiceLinks(input: FinancialReconciliationRepairInput) {
    const values = financialReconciliationRepairSchema.parse({
      ...input,
      action: "repair_receipt_invoice_links",
    })

    return this.repair(values)
  }

  async repair(input: unknown): Promise<FinancialReconciliationRepairReport> {
    const values = financialReconciliationRepairSchema.parse(input)
    const context = await this.authService.requirePermission(
      values.dryRun ? "finance.manage" : "settings.manage"
    )

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const before = await this.repository.getCounts({
      organizationId: values.organizationId,
      hostelId: values.hostelId ?? null,
    })

    if (!values.dryRun && !areOperationalRepairsEnabled()) {
      return {
        dryRun: true,
        organizationId: values.organizationId,
        hostelId: values.hostelId ?? null,
        before,
        after: before,
        repairs: {},
        message:
          "Financial repair execution is disabled by OPERATIONAL_REPAIRS_ENABLED=false. Dry-run diagnostics were returned and no records were changed.",
      }
    }

    const repairs: FinancialReconciliationRepairReport["repairs"] = {}
    const repairInput = {
      organizationId: values.organizationId,
      hostelId: values.hostelId ?? null,
      actorUserId: context.authUser.id,
      dryRun: values.dryRun,
    }

    if (values.action === "repair_monthly_fee_invoices" || values.action === "repair_all") {
      repairs.monthlyFeeInvoices =
        await this.repository.repairMonthlyFeeInvoices(repairInput)
    }

    if (values.action === "repair_advance_payment_invoices" || values.action === "repair_all") {
      repairs.advancePaymentInvoices =
        await this.repository.repairAdvancePaymentInvoices(repairInput)
    }

    if (values.action === "repair_receipt_invoice_links" || values.action === "repair_all") {
      repairs.receiptInvoiceLinks =
        await this.repository.repairReceiptInvoiceLinks(repairInput)
    }

    if (values.action === "repair_all") {
      repairs.missingInvoicePdfs = await this.invoicesService.repairMissingInvoicePdfs({
        organizationId: values.organizationId,
        hostelId: values.hostelId ?? null,
        actorUserId: context.authUser.id,
        dryRun: values.dryRun,
        limit: 500,
      })
    }

    const after = values.dryRun
      ? before
      : await this.repository.getCounts({
          organizationId: values.organizationId,
          hostelId: values.hostelId ?? null,
        })

    return {
      dryRun: values.dryRun,
      organizationId: values.organizationId,
      hostelId: values.hostelId ?? null,
      before,
      after,
      repairs,
      message: values.dryRun
        ? "Dry run completed. No financial records were changed."
        : "Financial reconciliation repair completed.",
    }
  }

  async regenerateMissingReceipts(input: unknown): Promise<MissingReceiptRepairReport> {
    const values = missingReceiptRegenerationSchema.parse(input)
    const context = await this.authService.requirePermission(
      values.dryRun ? "finance.manage" : "settings.manage"
    )
    const organizationId = values.organizationId
    const hostelId = values.hostelId ?? null
    const dryRun = values.dryRun

    this.authService.requireHostelAccess(context, organizationId, hostelId)

    const before = await this.repository.getCounts({ organizationId, hostelId })
    const candidates = await this.repository.listVerifiedPaymentsMissingReceipts({
      organizationId,
      hostelId,
      limit: values.limit,
    })

    if (!dryRun && !areOperationalRepairsEnabled()) {
      return {
        dryRun: true,
        organizationId,
        hostelId,
        before,
        after: before,
        candidates: candidates.length,
        receiptsGenerated: 0,
        skippedExisting: 0,
        message:
          "Receipt repair execution is disabled by OPERATIONAL_REPAIRS_ENABLED=false. Dry-run diagnostics were returned and no records were changed.",
      }
    }

    if (dryRun) {
      return {
        dryRun: true,
        organizationId,
        hostelId,
        before,
        after: before,
        candidates: candidates.length,
        receiptsGenerated: 0,
        skippedExisting: 0,
        message: "Dry run completed. No receipt documents were generated.",
      }
    }

    let receiptsGenerated = 0
    let skippedExisting = 0

    for (const payment of candidates) {
      const existingReceipt = await this.uploadsRepository.findLatestPaymentProof(
        payment.organization_id,
        payment.id
      )

      if (existingReceipt?.status === "verified") {
        skippedExisting += 1
        continue
      }

      const file = createManualPaymentReceiptMarker(payment.id)
      const storagePath = [
        payment.organization_id,
        payment.resident_id,
        "manual-payment-receipts",
        `${payment.id}.png`,
      ].join("/")
      const now = new Date().toISOString()

      await this.uploadsRepository.uploadObject("payment-screenshots", storagePath, file, {
        upsert: true,
        cacheControl: "3600",
      })

      await this.uploadsRepository.createDocument({
        organization_id: payment.organization_id,
        hostel_id: payment.hostel_id,
        resident_id: payment.resident_id,
        payment_id: payment.id,
        invoice_id: payment.invoice_id,
        uploaded_by_user_id: context.authUser.id,
        document_type: "payment_receipt",
        status: "verified",
        bucket_name: "payment-screenshots",
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        verified_by: context.authUser.id,
        verified_at: now,
        is_public: false,
        metadata: {
          source: "financial_reconciliation",
          generated_receipt_marker: true,
          method: payment.method,
          amount: payment.amount,
          manual_reference: payment.manual_reference,
          generated_at: now,
          financial_repair_action: "regenerate_missing_receipts",
        },
        created_by: context.authUser.id,
        updated_by: context.authUser.id,
      })

      receiptsGenerated += 1
    }

    const after = await this.repository.getCounts({ organizationId, hostelId })

    await this.operationsRepository.createAuditLog({
      organization_id: organizationId,
      hostel_id: hostelId,
      actor_user_id: context.authUser.id,
      table_name: "financial_reconciliation",
      record_id: null,
      action: "financial_reconciliation.missing_receipts_regenerated",
      metadata: {
        candidates: candidates.length,
        receiptsGenerated,
        skippedExisting,
        before,
        after,
      },
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    return {
      dryRun: false,
      organizationId,
      hostelId,
      before,
      after,
      candidates: candidates.length,
      receiptsGenerated,
      skippedExisting,
      message: "Missing receipt regeneration completed.",
    }
  }
}
