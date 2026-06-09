import { describe, expect, it, vi } from "vitest"

import { forbidden } from "@/lib/api"
import { InvoicesService } from "@/services/invoices"
import {
  PAYMENT_ID,
  paymentFixture,
  residentFixture,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext, residentAuthContext } from "@/tests/helpers"
import type { Tables } from "@/types/database"

const INVOICE_ID = "00000000-0000-4000-8000-000000000155"
const DOCUMENT_ID = "00000000-0000-4000-8000-000000000156"
const STORAGE_PATH = `${TEST_ORGANIZATION_ID}/${TEST_HOSTEL_ID}/00000000-0000-4000-8000-000000000031/sbh-2026-0001.pdf`

describe("InvoicesService receipt downloads", () => {
  it("allows admins to download verified payment receipt PDFs in their hostel scope", async () => {
    const harness = createDownloadHarness()
    const invoice = invoiceFixture()

    harness.invoicesRepository.getById.mockResolvedValue(invoice)
    harness.adminStorageService.downloadInvoicePdf.mockResolvedValue(pdfDownload())

    await expect(
      harness.service.downloadInvoicePdf({
        organizationId: TEST_ORGANIZATION_ID,
        invoiceId: INVOICE_ID,
      })
    ).resolves.toMatchObject({
      invoiceId: INVOICE_ID,
      invoiceNumber: invoice.invoice_number,
      storagePath: STORAGE_PATH,
      contentType: "application/pdf",
    })

    expect(harness.authService.requireHostelAccess).toHaveBeenCalledWith(
      adminAuthContext(),
      TEST_ORGANIZATION_ID,
      TEST_HOSTEL_ID
    )
    expect(harness.adminStorageService.downloadInvoicePdf).toHaveBeenCalledWith(STORAGE_PATH)
  })

  it("allows residents to download their own receipt PDFs", async () => {
    const context = residentAuthContext()
    const harness = createDownloadHarness({ context })

    harness.invoicesRepository.getById.mockResolvedValue(invoiceFixture())
    harness.invoicesRepository.getResident.mockResolvedValue(
      residentFixture({ user_id: context.authUser.id })
    )
    harness.adminStorageService.downloadInvoicePdf.mockResolvedValue(pdfDownload())

    await expect(
      harness.service.downloadInvoicePdf({
        organizationId: TEST_ORGANIZATION_ID,
        invoiceId: INVOICE_ID,
      })
    ).resolves.toMatchObject({
      invoiceId: INVOICE_ID,
      storagePath: STORAGE_PATH,
    })

    expect(harness.authService.requireHostelAccess).not.toHaveBeenCalled()
    expect(harness.adminStorageService.downloadInvoicePdf).toHaveBeenCalledWith(STORAGE_PATH)
  })

  it("blocks residents from downloading another resident receipt", async () => {
    const context = residentAuthContext()
    const harness = createDownloadHarness({ context })

    harness.invoicesRepository.getById.mockResolvedValue(invoiceFixture())
    harness.invoicesRepository.getResident.mockResolvedValue(
      residentFixture({ user_id: "00000000-0000-4000-8000-000000000099" })
    )

    await expect(
      harness.service.downloadInvoicePdf({
        organizationId: TEST_ORGANIZATION_ID,
        invoiceId: INVOICE_ID,
      })
    ).rejects.toThrow("Residents can only download their own invoices.")

    expect(harness.adminStorageService.downloadInvoicePdf).not.toHaveBeenCalled()
  })

  it("blocks cross-tenant receipt downloads before invoice lookup", async () => {
    const harness = createDownloadHarness()

    harness.authService.requireOrganizationAccess.mockImplementation(() => {
      throw forbidden("Organization access required.")
    })

    await expect(
      harness.service.downloadInvoicePdf({
        organizationId: TEST_ORGANIZATION_ID,
        invoiceId: INVOICE_ID,
      })
    ).rejects.toThrow("Organization access required.")

    expect(harness.invoicesRepository.getById).not.toHaveBeenCalled()
    expect(harness.adminStorageService.downloadInvoicePdf).not.toHaveBeenCalled()
  })

  it("repairs missing verified payment receipt storage before download", async () => {
    const harness = createDownloadHarness()
    const missingPdfInvoice = invoiceFixture({
      pdf_document_id: null,
      pdf_storage_path: null,
      metadata: { payment_id: PAYMENT_ID },
    })
    const repairedInvoice = invoiceFixture({
      pdf_document_id: DOCUMENT_ID,
      pdf_storage_path: STORAGE_PATH,
      metadata: { payment_id: PAYMENT_ID },
    })

    harness.invoicesRepository.getById.mockResolvedValue(missingPdfInvoice)
    harness.adminInvoicesRepository.update.mockResolvedValue(repairedInvoice)
    harness.adminStorageService.downloadInvoicePdf.mockResolvedValue(pdfDownload())

    const result = await harness.service.downloadInvoicePdf({
      organizationId: TEST_ORGANIZATION_ID,
      invoiceId: INVOICE_ID,
    })

    expect(result.storagePath).toBe(STORAGE_PATH)
    expect(harness.pdfService.render).toHaveBeenCalled()
    expect(harness.adminStorageService.uploadInvoicePdf).toHaveBeenCalledWith(
      STORAGE_PATH,
      expect.objectContaining({
        contentType: "application/pdf",
      }),
      { upsert: true }
    )
    expect(harness.adminInvoicesRepository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_id: INVOICE_ID,
        document_type: "invoice_pdf",
        storage_path: STORAGE_PATH,
        status: "verified",
      })
    )
  })

  it("regenerates corrupt receipt PDFs and then downloads the repaired file", async () => {
    const harness = createDownloadHarness()
    const invoice = invoiceFixture({ metadata: { payment_id: PAYMENT_ID } })

    harness.invoicesRepository.getById.mockResolvedValue(invoice)
    harness.adminInvoicesRepository.update.mockResolvedValue(invoice)
    harness.adminStorageService.downloadInvoicePdf
      .mockResolvedValueOnce(pdfDownload(new TextEncoder().encode("not-a-pdf")))
      .mockResolvedValueOnce(pdfDownload())

    await expect(
      harness.service.downloadInvoicePdf({
        organizationId: TEST_ORGANIZATION_ID,
        invoiceId: INVOICE_ID,
      })
    ).resolves.toMatchObject({
      storagePath: STORAGE_PATH,
    })

    expect(harness.pdfService.render).toHaveBeenCalled()
    expect(harness.adminStorageService.uploadInvoicePdf).toHaveBeenCalledWith(
      STORAGE_PATH,
      expect.any(Object),
      { upsert: true }
    )
    expect(harness.adminStorageService.downloadInvoicePdf).toHaveBeenCalledTimes(2)
  })

  it("validates receipt storage before issuing legacy signed URLs", async () => {
    const harness = createDownloadHarness()
    const signedUrl = "https://storage.example/signed-receipt-url"

    harness.invoicesRepository.getById.mockResolvedValue(invoiceFixture())
    harness.adminStorageService.downloadInvoicePdf.mockResolvedValue(pdfDownload())
    harness.adminStorageService.createSignedDownloadUrl.mockResolvedValue(signedUrl)

    await expect(
      harness.service.createSignedDownloadUrl({
        organizationId: TEST_ORGANIZATION_ID,
        invoiceId: INVOICE_ID,
        expiresInSeconds: 900,
      })
    ).resolves.toMatchObject({
      invoiceId: INVOICE_ID,
      signedUrl,
    })

    expect(harness.adminStorageService.createSignedDownloadUrl).toHaveBeenCalledWith(
      STORAGE_PATH,
      900
    )
  })
})

function createDownloadHarness(input: { context?: ReturnType<typeof adminAuthContext> } = {}) {
  const context = input.context ?? adminAuthContext()
  const service = new InvoicesService({} as never)
  const authService = {
    getCurrentContext: vi.fn().mockResolvedValue(context),
    requireOrganizationAccess: vi.fn(),
    requireHostelAccess: vi.fn(),
  }
  const invoicesRepository = {
    getById: vi.fn(),
    getResident: vi.fn(),
  }
  const adminInvoicesRepository = {
    findInvoicePdfDocument: vi.fn().mockResolvedValue(null),
    getOrganization: vi.fn().mockResolvedValue({
      name: "Sadhana Boys Hostel",
      legal_name: "Sadhana Boys Hostel",
      billing_email: "billing@sadhana.test",
      contact_phone: "+91 90000 00000",
      address_line1: "Line 1",
      address_line2: null,
      city: "Hyderabad",
      state: "TS",
      postal_code: "500001",
      slug: "sadhana",
    }),
    getHostel: vi.fn().mockResolvedValue({
      name: "Main Hostel",
      code: "MAIN",
      phone: "+91 90000 00001",
      email: "hostel@sadhana.test",
      address_line1: "Hostel Line 1",
      address_line2: null,
      city: "Hyderabad",
      state: "TS",
      postal_code: "500001",
    }),
    getResident: vi.fn().mockResolvedValue(residentFixture()),
    getFeeRecord: vi.fn(),
    getPaymentById: vi.fn().mockResolvedValue(
      paymentFixture({
        status: "verified",
        invoice_id: INVOICE_ID,
        verified_at: "2026-06-01T00:00:00.000Z",
      })
    ),
    findPaymentByInvoiceId: vi.fn(),
    createDocument: vi.fn().mockResolvedValue(documentFixture()),
    update: vi.fn(),
  }
  const pdfService = {
    render: vi.fn().mockResolvedValue({
      bytes: validPdfBytes(),
      contentType: "application/pdf",
      fileName: "SBH-2026-0001.pdf",
    }),
  }
  const storageService = {
    bucketName: "invoices",
  }
  const adminStorageService = {
    bucketName: "invoices",
    downloadInvoicePdf: vi.fn(),
    uploadInvoicePdf: vi.fn(),
    createSignedDownloadUrl: vi.fn(),
  }

  Object.assign(service, {
    authService,
    invoicesRepository,
    adminInvoicesRepository,
    pdfService,
    storageService,
    adminStorageService,
  })

  return {
    service,
    authService,
    invoicesRepository,
    adminInvoicesRepository,
    pdfService,
    adminStorageService,
  }
}

function invoiceFixture(overrides: Partial<Tables<"invoices">> = {}): Tables<"invoices"> {
  return {
    id: INVOICE_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    resident_id: "00000000-0000-4000-8000-000000000031",
    monthly_fee_record_id: null,
    invoice_number: "SBH-2026-0001",
    issue_date: "2026-06-01",
    due_date: "2026-06-01",
    subtotal_amount: 6500,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 6500,
    paid_amount: 6500,
    balance_amount: 0,
    status: "paid",
    pdf_document_id: DOCUMENT_ID,
    pdf_storage_path: STORAGE_PATH,
    metadata: { payment_id: PAYMENT_ID },
    is_active: true,
    cancellation_reason: null,
    cancelled_at: null,
    cancelled_by: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

function documentFixture(overrides: Partial<Tables<"documents">> = {}): Tables<"documents"> {
  return {
    id: DOCUMENT_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    resident_id: "00000000-0000-4000-8000-000000000031",
    payment_id: null,
    invoice_id: INVOICE_ID,
    uploaded_by_user_id: adminAuthContext().authUser.id,
    document_type: "invoice_pdf",
    bucket_name: "invoices",
    storage_path: STORAGE_PATH,
    file_name: "SBH-2026-0001.pdf",
    mime_type: "application/pdf",
    file_size_bytes: validPdfBytes().byteLength,
    checksum: null,
    is_public: false,
    status: "verified",
    verified_at: "2026-06-01T00:00:00.000Z",
    verified_by: adminAuthContext().authUser.id,
    rejection_reason: null,
    metadata: {},
    is_active: true,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    created_by: adminAuthContext().authUser.id,
    updated_by: adminAuthContext().authUser.id,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

function pdfDownload(bytes = validPdfBytes()) {
  return {
    bytes,
    contentType: "application/pdf" as const,
    fileSizeBytes: bytes.byteLength,
  }
}

function validPdfBytes() {
  return new TextEncoder().encode("%PDF-1.7\n%%EOF")
}
