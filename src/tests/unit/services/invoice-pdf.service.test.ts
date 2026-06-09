import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"

import { InvoicePdfService } from "@/services/invoices/invoice-pdf.service"
import type { InvoiceTemplateData } from "@/services/invoices/invoice-template"

describe("InvoicePdfService", () => {
  it("generates parseable non-empty payment receipt PDFs", async () => {
    const service = new InvoicePdfService()
    const pdf = await service.render(receiptTemplate())
    const document = await PDFDocument.load(pdf.bytes)

    expect(pdf.contentType).toBe("application/pdf")
    expect(pdf.fileName).toBe("SBH-2026-0001.pdf")
    expect(new TextDecoder().decode(pdf.bytes.slice(0, 5))).toBe("%PDF-")
    expect(document.getPageCount()).toBeGreaterThan(0)
    expect(pdf.bytes.byteLength).toBeGreaterThan(500)
  })
})

function receiptTemplate(): InvoiceTemplateData {
  return {
    organization: {
      name: "Sadhana Boys Hostel",
      legal_name: "Sadhana Boys Hostel",
      billing_email: "billing@sadhana.test",
      contact_phone: "+91 90000 00000",
      address_line1: "Line 1",
      address_line2: null,
      city: "Hyderabad",
      state: "TS",
      postal_code: "500001",
    },
    hostel: {
      name: "Main Hostel",
      code: "MAIN",
      phone: "+91 90000 00001",
      email: "hostel@sadhana.test",
      address_line1: "Hostel Line 1",
      address_line2: null,
      city: "Hyderabad",
      state: "TS",
      postal_code: "500001",
    },
    resident: {
      full_name: "Resident User",
      admission_number: "SBH-T-001",
      phone: "+91 90000 00002",
      email: "resident@sadhana.test",
    },
    invoice: {
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
    },
    lineItems: [
      {
        description: "Verified payment receipt - UPI-TXN-001",
        amount: 6500,
      },
    ],
    footerNote:
      "This is a system-generated receipt for a verified hostel payment.",
  }
}
