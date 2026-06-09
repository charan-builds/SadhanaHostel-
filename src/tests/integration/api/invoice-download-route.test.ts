import { afterEach, describe, expect, it, vi } from "vitest"

import { TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import { routeContext } from "@/tests/helpers"

const INVOICE_ID = "00000000-0000-4000-8000-000000000155"

describe("invoice download API route", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/services/invoices")
  })

  it("streams verified receipt PDFs with browser download headers", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\n%%EOF")
    const downloadInvoicePdf = vi.fn().mockResolvedValue({
      invoiceId: INVOICE_ID,
      invoiceNumber: "SBH-2026-0001",
      storagePath: `${TEST_ORGANIZATION_ID}/receipts/SBH-2026-0001.pdf`,
      fileName: "SBH-2026-0001.pdf",
      contentType: "application/pdf",
      bytes,
    })

    vi.doMock("@/services/invoices", () => ({
      InvoicesService: {
        create: vi.fn().mockResolvedValue({ downloadInvoicePdf }),
      },
    }))

    const { GET } = await import("@/app/api/v1/invoices/[id]/download/route")
    const response = await GET(
      new Request(
        `http://localhost/api/v1/invoices/${INVOICE_ID}/download?organizationId=${TEST_ORGANIZATION_ID}`
      ),
      routeContext({ id: INVOICE_ID })
    )
    const responseBytes = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toContain("attachment;")
    expect(response.headers.get("content-disposition")).toContain("SBH-2026-0001.pdf")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(new TextDecoder().decode(responseBytes.slice(0, 5))).toBe("%PDF-")
    expect(downloadInvoicePdf).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      invoiceId: INVOICE_ID,
    })
  })
})
