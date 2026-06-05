import { describe, expect, it, vi } from "vitest"

import { InvoiceStorageService } from "@/services/invoices/invoice-storage.service"

describe("InvoiceStorageService", () => {
  it.each([
    ["cash payment invoice", "cash/INV-2026-00012.pdf"],
    ["UPI payment invoice", "upi/INV-2026-00013.pdf"],
    ["advance payment receipt invoice", "advance/INV-2026-00014.pdf"],
    ["monthly fee invoice", "monthly-fee/INV-2026-00015.pdf"],
  ])("returns a plain signed URL string for %s", async (_caseName, storagePath) => {
    const signedUrl = `https://storage.example/invoices/${storagePath}?token=signed`
    const { db, createSignedUrl, from } = createStorageHarness({
      data: { signedUrl },
      error: null,
    })
    const service = new InvoiceStorageService(db)

    await expect(service.createSignedDownloadUrl(storagePath, 900)).resolves.toBe(signedUrl)

    expect(from).toHaveBeenCalledWith("invoices")
    expect(createSignedUrl).toHaveBeenCalledWith(storagePath, 900)
  })

  it("fails clearly when Supabase does not return a signed URL", async () => {
    const { db } = createStorageHarness({
      data: {},
      error: null,
    })
    const service = new InvoiceStorageService(db)

    await expect(
      service.createSignedDownloadUrl("monthly-fee/INV-2026-00016.pdf", 900)
    ).rejects.toMatchObject({
      code: "INVOICE_SIGNED_URL_FAILED",
      message: "Invoice PDF signed URL could not be generated.",
    })
  })
})

function createStorageHarness(response: {
  data: Record<string, unknown> | null
  error: { message: string } | null
}) {
  const createSignedUrl = vi.fn().mockResolvedValue(response)
  const from = vi.fn().mockReturnValue({ createSignedUrl })

  return {
    createSignedUrl,
    from,
    db: {
      storage: {
        from,
      },
    } as never,
  }
}
