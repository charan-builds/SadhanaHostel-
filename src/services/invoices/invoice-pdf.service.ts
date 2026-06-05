import "server-only"

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib"

import { measureAsync } from "@/lib/performance"

import {
  formatCurrency,
  getInvoiceHostelAddressLines,
  getInvoiceHostelContactLine,
  type InvoiceTemplateData,
} from "./invoice-template"

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
    this.drawFooter(page, data, bold, regular)

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
    page.drawText(safePdfText(data.organization.legal_name ?? data.organization.name), {
      x: 42,
      y: 812,
      size: 18,
      font: bold,
      color: rgb(1, 1, 1),
    })
    page.drawText(safePdfText(data.hostel.name), {
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
    page.drawText(safePdfText(data.resident.full_name), {
      x: 335,
      y: 716,
      size: 11,
      font: regular,
      color: rgb(0.12, 0.18, 0.24),
    })
    page.drawText(safePdfText(`Admission: ${data.resident.admission_number}`), {
      x: 335,
      y: 700,
      size: 9,
      font: regular,
      color: rgb(0.28, 0.34, 0.42),
    })
    page.drawText(safePdfText(`Phone: ${data.resident.phone ?? "N/A"}`), {
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

      page.drawText(safePdfText(item.description).slice(0, 70), {
        x: 56,
        y: y + 9,
        size: 10,
        font: regular,
        color: rgb(0.12, 0.18, 0.24),
      })
      page.drawText(formatCurrencyForPdf(item.amount), {
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
      page.drawText(formatCurrencyForPdf(amount), { x: 455, y, size: 10, font })
    })
  }

  private drawFooter(
    page: PDFPage,
    data: InvoiceTemplateData,
    bold: PDFFont,
    regular: PDFFont
  ) {
    page.drawRectangle({
      x: 42,
      y: 136,
      width: 511,
      height: 0.75,
      color: rgb(0.86, 0.89, 0.93),
    })

    let y = 120
    for (const noteLine of wrapText(safePdfText(data.footerNote), regular, 8, 511).slice(0, 2)) {
      page.drawText(noteLine, {
        x: 42,
        y,
        size: 8,
        font: regular,
        color: rgb(0.38, 0.44, 0.52),
      })
      y -= 11
    }

    y -= 8
    page.drawText("Hostel Address", {
      x: 42,
      y,
      size: 8.5,
      font: bold,
      color: rgb(0.12, 0.18, 0.24),
    })

    y -= 13
    const addressLines = getInvoiceHostelAddressLines(data).flatMap((line) =>
      wrapText(safePdfText(line), regular, 8.5, 511)
    )
    for (const addressLine of addressLines.slice(0, 3)) {
      page.drawText(addressLine, {
        x: 42,
        y,
        size: 8.5,
        font: regular,
        color: rgb(0.28, 0.34, 0.42),
      })
      y -= 11
    }

    const contactLine = safePdfText(getInvoiceHostelContactLine(data))
    if (contactLine && y >= 42) {
      page.drawText(contactLine, {
        x: 42,
        y,
        size: 8,
        font: regular,
        color: rgb(0.38, 0.44, 0.52),
      })
    }
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
    page.drawText(safePdfText(value), {
      x: x + 78,
      y,
      size: 9,
      font: regular,
      color: rgb(0.12, 0.18, 0.24),
    })
  }
}

function formatCurrencyForPdf(amount: number) {
  return safePdfText(formatCurrency(amount))
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !currentLine) {
      currentLine = candidate
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.length > 0 ? lines : [""]
}

function safePdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\u20b9/g, "Rs.")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
}
