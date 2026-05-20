import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { conflict, forbidden } from "@/lib/api/api-error"
import { logAuditEvent } from "@/lib/logger"
import { measureAsync } from "@/lib/performance"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { InvoicesRepository } from "@/repositories/invoices.repository"
import type {
  InvoiceRow,
  MonthlyFeeRecordRow,
  OrganizationRow,
  HostelRow,
  ResidentRow,
} from "@/repositories/invoices.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type { TablesInsert } from "@/types/database"
import {
  generateInvoiceSchema,
  invoiceDownloadSchema,
} from "@/validations/invoice.validation"

import { assertFound, AuthService } from "../auth.service"
import { createInvoiceMetadata } from "./invoice-metadata"
import { createInvoiceNumber } from "./invoice-numbering"
import { InvoicePdfService } from "./invoice-pdf.service"
import { InvoiceStorageService } from "./invoice-storage.service"
import {
  buildInvoiceStoragePath,
  prepareInvoiceDownloadToken,
} from "./invoice-storage"
import { createMonthlyFeeInvoiceTemplateData } from "./invoice-template"

export type PrepareInvoiceDraftInput = {
  organizationId: string
  organizationSlug: string
  hostelId: string
  residentId: string
  monthlyFeeRecordId?: string | null
  sequence: number
  subtotalAmount: number
  discountAmount?: number
  taxAmount?: number
  paidAmount?: number
  dueDate?: string | null
  periodMonth?: string
  generatedByUserId?: string | null
}

export class InvoiceFoundationService {
  prepareInvoiceDraft(input: PrepareInvoiceDraftInput): TablesInsert<"invoices"> {
    const invoiceNumber = createInvoiceNumber({
      organizationSlug: input.organizationSlug,
      sequence: input.sequence,
    })
    const discountAmount = input.discountAmount ?? 0
    const taxAmount = input.taxAmount ?? 0
    const paidAmount = input.paidAmount ?? 0
    const totalAmount = input.subtotalAmount - discountAmount + taxAmount

    return {
      organization_id: input.organizationId,
      hostel_id: input.hostelId,
      resident_id: input.residentId,
      monthly_fee_record_id: input.monthlyFeeRecordId,
      invoice_number: invoiceNumber,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: input.dueDate,
      subtotal_amount: input.subtotalAmount,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance_amount: totalAmount - paidAmount,
      status: paidAmount >= totalAmount ? "paid" : "issued",
      pdf_storage_path: buildInvoiceStoragePath({
        organizationId: input.organizationId,
        hostelId: input.hostelId,
        residentId: input.residentId,
        invoiceNumber,
      }),
      metadata: createInvoiceMetadata({
        organizationId: input.organizationId,
        hostelId: input.hostelId,
        residentId: input.residentId,
        periodMonth: input.periodMonth,
        generatedByUserId: input.generatedByUserId,
        source: "monthly_fee",
      }),
      created_by: input.generatedByUserId,
      updated_by: input.generatedByUserId,
    }
  }

  prepareDownloadToken(input: {
    invoiceId: string
    organizationId: string
    residentId: string
    expiresInSeconds?: number
  }) {
    return prepareInvoiceDownloadToken({
      invoiceId: input.invoiceId,
      organizationId: input.organizationId,
      residentId: input.residentId,
      expiresInSeconds: input.expiresInSeconds ?? 900,
    })
  }
}

export class InvoicesService {
  private readonly authService: AuthService
  private readonly invoicesRepository: InvoicesRepository
  private readonly pdfService: InvoicePdfService
  private readonly storageService: InvoiceStorageService

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.invoicesRepository = new InvoicesRepository(db)
    this.pdfService = new InvoicePdfService()
    this.storageService = new InvoiceStorageService(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new InvoicesService(db)
  }

  async generateMonthlyFeeInvoice(input: unknown) {
    const values = generateInvoiceSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return measureAsync(
      {
        name: "invoice_generate_monthly_fee",
        kind: "service",
        slowMs: 1200,
        tags: {
          organizationId: values.organizationId,
        },
      },
      async () => {
        const existingInvoice = await this.invoicesRepository.findByFeeRecord(
          values.monthlyFeeRecordId,
          values.organizationId
        )

        if (existingInvoice?.pdf_storage_path) {
          return existingInvoice
        }

        const invoiceContext = await this.loadMonthlyFeeInvoiceContext(
          values.organizationId,
          values.monthlyFeeRecordId
        )
        const invoice = existingInvoice ?? (await this.createInvoiceRecord(invoiceContext, context.authUser.id))
        const invoiceWithPdf = await this.ensureInvoicePdf(invoice, invoiceContext, context.authUser.id)

        logAuditEvent({
          action: "invoice.generated",
          actorUserId: context.authUser.id,
          organizationId: values.organizationId,
          targetTable: "invoices",
          targetId: invoiceWithPdf.id,
          outcome: "success",
          details: {
            monthlyFeeRecordId: values.monthlyFeeRecordId,
            invoiceNumber: invoiceWithPdf.invoice_number,
          },
        })

        return invoiceWithPdf
      }
    )
  }

  async createSignedDownloadUrl(input: unknown) {
    const values = invoiceDownloadSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const invoice = assertFound(
      await this.invoicesRepository.getById(values.invoiceId, values.organizationId),
      "Invoice not found."
    )

    if (!context.roles.some((role) => [...ADMIN_ROLES, "staff"].includes(role))) {
      const resident = await this.invoicesRepository.getResident(
        invoice.resident_id,
        values.organizationId
      )

      if (!resident || resident.user_id !== context.authUser.id) {
        throw forbidden("Residents can only download their own invoices.")
      }
    }

    if (!invoice.pdf_storage_path) {
      throw conflict("Invoice PDF is not available yet.")
    }

    const signedUrl = await this.storageService.createSignedDownloadUrl(
      invoice.pdf_storage_path,
      values.expiresInSeconds
    )

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      signedUrl,
      downloadToken: prepareInvoiceDownloadToken({
        invoiceId: invoice.id,
        organizationId: invoice.organization_id,
        residentId: invoice.resident_id,
        expiresInSeconds: values.expiresInSeconds,
      }),
    }
  }

  private async loadMonthlyFeeInvoiceContext(
    organizationId: string,
    monthlyFeeRecordId: string
  ) {
    const feeRecord = assertFound(
      await this.invoicesRepository.getFeeRecord(monthlyFeeRecordId, organizationId),
      "Monthly fee record not found."
    )
    const [organization, hostel, resident] = await Promise.all([
      this.invoicesRepository.getOrganization(organizationId),
      this.invoicesRepository.getHostel(feeRecord.hostel_id, organizationId),
      this.invoicesRepository.getResident(feeRecord.resident_id, organizationId),
    ])

    return {
      feeRecord,
      organization: assertFound(organization, "Organization not found."),
      hostel: assertFound(hostel, "Hostel not found."),
      resident: assertFound(resident, "Resident not found."),
    }
  }

  private async createInvoiceRecord(
    context: {
      organization: OrganizationRow
      hostel: HostelRow
      resident: ResidentRow
      feeRecord: MonthlyFeeRecordRow
    },
    actorUserId: string
  ) {
    const issueMonth = new Date().toISOString().slice(0, 7)
    const sequence =
      (await this.invoicesRepository.countIssuedInvoicesForMonth(
        context.organization.id,
        issueMonth
      )) + 1
    const invoiceNumber = createInvoiceNumber({
      organizationSlug: context.organization.slug,
      sequence,
    })
    const storagePath = buildInvoiceStoragePath({
      organizationId: context.organization.id,
      hostelId: context.hostel.id,
      residentId: context.resident.id,
      invoiceNumber,
    })

    return this.invoicesRepository.create({
      organization_id: context.organization.id,
      hostel_id: context.hostel.id,
      resident_id: context.resident.id,
      monthly_fee_record_id: context.feeRecord.id,
      invoice_number: invoiceNumber,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: context.feeRecord.due_date,
      subtotal_amount:
        context.feeRecord.base_amount +
        context.feeRecord.penalty_amount +
        context.feeRecord.adjustment_amount,
      discount_amount:
        context.feeRecord.discount_amount +
        context.feeRecord.advance_adjustment_amount,
      tax_amount: 0,
      total_amount: context.feeRecord.total_amount,
      paid_amount: context.feeRecord.paid_amount,
      balance_amount: context.feeRecord.balance_amount,
      status:
        context.feeRecord.balance_amount <= 0
          ? "paid"
          : context.feeRecord.paid_amount > 0
            ? "partially_paid"
            : "issued",
      pdf_storage_path: storagePath,
      metadata: createInvoiceMetadata({
        organizationId: context.organization.id,
        hostelId: context.hostel.id,
        residentId: context.resident.id,
        periodMonth: context.feeRecord.period_month,
        generatedByUserId: actorUserId,
        source: "monthly_fee",
      }),
      created_by: actorUserId,
      updated_by: actorUserId,
    })
  }

  private async ensureInvoicePdf(
    invoice: InvoiceRow,
    context: {
      organization: OrganizationRow
      hostel: HostelRow
      resident: ResidentRow
      feeRecord: MonthlyFeeRecordRow
    },
    actorUserId: string
  ) {
    if (invoice.pdf_document_id && invoice.pdf_storage_path) {
      return invoice
    }

    const storagePath =
      invoice.pdf_storage_path ??
      buildInvoiceStoragePath({
        organizationId: context.organization.id,
        hostelId: context.hostel.id,
        residentId: context.resident.id,
        invoiceNumber: invoice.invoice_number,
      })
    const pdf = await this.pdfService.render(
      createMonthlyFeeInvoiceTemplateData({
        ...context,
        invoice,
      })
    )

    await this.storageService.uploadInvoicePdf(storagePath, pdf)

    const document = await this.invoicesRepository.createDocument({
      organization_id: invoice.organization_id,
      hostel_id: invoice.hostel_id,
      resident_id: invoice.resident_id,
      invoice_id: invoice.id,
      uploaded_by_user_id: actorUserId,
      document_type: "invoice_pdf",
      bucket_name: this.storageService.bucketName,
      storage_path: storagePath,
      file_name: pdf.fileName,
      mime_type: pdf.contentType,
      file_size_bytes: pdf.bytes.byteLength,
      is_public: false,
      status: "verified",
      verified_at: new Date().toISOString(),
      verified_by: actorUserId,
      metadata: {
        invoice_number: invoice.invoice_number,
        generated_by: actorUserId,
      },
      created_by: actorUserId,
      updated_by: actorUserId,
    })

    return this.invoicesRepository.update(invoice.id, invoice.organization_id, {
      pdf_document_id: document.id,
      pdf_storage_path: storagePath,
      updated_by: actorUserId,
    })
  }
}
