import "server-only"

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib"

import { measureAsync } from "@/lib/performance"

import { formatCurrency, type InvoiceTemplateData } from "./invoice-template"

export type GeneratedInvoicePdf = {
  bytes: Uint8Array
  contentType: "application/pdf"
  fileName: string
}

export class InvoicePdfService {
  async render(data: InvoiceTemplateData): Promise<GeneratedInvoicePdf> {
    return measureAsync(
      {
        name: "invoice_pdf_render",
        kind: "service",
        slowMs: 750,
        tags: {
          status: data.invoice.status,
        },
      },
      async () => this.renderPdf(data)
    )
  }

  private async renderPdf(data: InvoiceTemplateData): Promise<GeneratedInvoicePdf> {
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([595.28, 841.89])
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

    this.drawHeader(page, data, bold, regular)
    this.drawInvoiceMeta(page, data, bold, regular)
    this.drawResidentBlock(page, data, bold, regular)
    this.drawLineItems(page, data, bold, regular)
    this.drawTotals(page, data, bold, regular)
    this.drawFooter(page, data, regular)

    const bytes = await pdf.save()

    return {
      bytes,
      contentType: "application/pdf",
      fileName: `${data.invoice.invoice_number}.pdf`,
    }
  }

  private drawHeader(
    page: PDFPage,
    data: InvoiceTemplateData,
    bold: PDFFont,
    regular: PDFFont
  ) {
    page.drawRectangle({
      x: 0,
      y: 780,
      width: 595.28,
      height: 61.89,
      color: rgb(0.08, 0.14, 0.2),
    })
    page.drawText(data.organization.legal_name ?? data.organization.name, {
      x: 42,
      y: 812,
      size: 18,
      font: bold,
      color: rgb(1, 1, 1),
    })
    page.drawText(data.hostel.name, {
      x: 42,
      y: 792,
      size: 10,
      font: regular,
      color: rgb(0.86, 0.9, 0.94),
    })
    page.drawText("INVOICE", {
      x: 460,
      y: 805,
      size: 20,
      font: bold,
      color: rgb(1, 1, 1),
    })
  }

  private drawInvoiceMeta(
    page: PDFPage,
    data: InvoiceTemplateData,
    bold: PDFFont,
    regular: PDFFont
  ) {
    this.drawLabelValue(page, "Invoice No", data.invoice.invoice_number, 42, 736, bold, regular)
    this.drawLabelValue(page, "Issue Date", data.invoice.issue_date, 42, 716, bold, regular)
    this.drawLabelValue(page, "Due Date", data.invoice.due_date ?? "N/A", 42, 696, bold, regular)
    this.drawLabelValue(page, "Status", data.invoice.status.toUpperCase(), 42, 676, bold, regular)
  }

  private drawResidentBlock(
    page: PDFPage,
    data: InvoiceTemplateData,
    bold: PDFFont,
    regular: PDFFont
  ) {
    page.drawText("Bill To", {
      x: 335,
      y: 736,
      size: 11,
      font: bold,
      color: rgb(0.12, 0.18, 0.24),
    })
    page.drawText(data.resident.full_name, {
      x: 335,
      y: 716,
      size: 11,
      font: regular,
      color: rgb(0.12, 0.18, 0.24),
    })
    page.drawText(`Admission: ${data.resident.admission_number}`, {
      x: 335,
      y: 700,
      size: 9,
      font: regular,
      color: rgb(0.28, 0.34, 0.42),
    })
    page.drawText(`Phone: ${data.resident.phone ?? "N/A"}`, {
      x: 335,
      y: 684,
      size: 9,
      font: regular,
      color: rgb(0.28, 0.34, 0.42),
    })
  }

  private drawLineItems(
    page: PDFPage,
    data: InvoiceTemplateData,
    bold: PDFFont,
    regular: PDFFont
  ) {
    const startY = 610

    page.drawRectangle({
      x: 42,
      y: startY,
      width: 511,
      height: 28,
      color: rgb(0.93, 0.95, 0.97),
    })
    page.drawText("Description", { x: 56, y: startY + 9, size: 10, font: bold })
    page.drawText("Amount", { x: 475, y: startY + 9, size: 10, font: bold })

    data.lineItems.forEach((item, index) => {
      const y = startY - 28 * (index + 1)

      page.drawText(item.description.slice(0, 70), {
        x: 56,
        y: y + 9,
        size: 10,
        font: regular,
        color: rgb(0.12, 0.18, 0.24),
      })
      page.drawText(formatCurrency(item.amount), {
        x: 440,
        y: y + 9,
        size: 10,
        font: regular,
        color: rgb(0.12, 0.18, 0.24),
      })
    })
  }

  private drawTotals(
    page: PDFPage,
    data: InvoiceTemplateData,
    bold: PDFFont,
    regular: PDFFont
  ) {
    const rows = [
      ["Subtotal", data.invoice.subtotal_amount],
      ["Discount", -data.invoice.discount_amount],
      ["Tax", data.invoice.tax_amount],
      ["Paid", -data.invoice.paid_amount],
      ["Balance", data.invoice.balance_amount],
    ] as const

    rows.forEach(([label, amount], index) => {
      const y = 350 - index * 24
      const font = label === "Balance" ? bold : regular

      page.drawText(label, { x: 365, y, size: 10, font })
      page.drawText(formatCurrency(amount), { x: 455, y, size: 10, font })
    })
  }

  private drawFooter(page: PDFPage, data: InvoiceTemplateData, regular: PDFFont) {
    const address = [
      data.organization.address_line1,
      data.organization.address_line2,
      data.organization.city,
      data.organization.state,
      data.organization.postal_code,
    ]
      .filter(Boolean)
      .join(", ")

    page.drawText(data.footerNote, {
      x: 42,
      y: 118,
      size: 8,
      font: regular,
      color: rgb(0.38, 0.44, 0.52),
    })
    page.drawText(address || data.organization.name, {
      x: 42,
      y: 92,
      size: 8,
      font: regular,
      color: rgb(0.38, 0.44, 0.52),
    })
  }

  private drawLabelValue(
    page: PDFPage,
    label: string,
    value: string,
    x: number,
    y: number,
    bold: PDFFont,
    regular: PDFFont
  ) {
    page.drawText(`${label}:`, {
      x,
      y,
      size: 9,
      font: bold,
      color: rgb(0.12, 0.18, 0.24),
    })
    page.drawText(value, {
      x: x + 78,
      y,
      size: 9,
      font: regular,
      color: rgb(0.12, 0.18, 0.24),
    })
  }
}
