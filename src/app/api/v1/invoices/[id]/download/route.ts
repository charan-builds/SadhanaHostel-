import { getQueryParams, withApiRoute } from "@/lib/api"
import { InvoicesService } from "@/services/invoices"

export const dynamic = "force-dynamic"

type InvoiceDownloadRouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: InvoiceDownloadRouteContext) {
  return withApiRoute(
    request,
    {
      route: "v1.invoices.download",
    },
    async () => {
      const { id } = await context.params
      const service = await InvoicesService.create()
      const pdf = await service.downloadInvoicePdf({
        ...getQueryParams(request),
        invoiceId: id,
      })

      return createPdfDownloadResponse(pdf)
    }
  )
}

function createPdfDownloadResponse(pdf: Awaited<ReturnType<InvoicesService["downloadInvoicePdf"]>>) {
  const body = new ArrayBuffer(pdf.bytes.byteLength)

  new Uint8Array(body).set(pdf.bytes)

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": pdf.contentType,
      "content-disposition": createContentDisposition(pdf.fileName),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-length": String(pdf.bytes.byteLength),
    },
  })
}

function createContentDisposition(fileName: string) {
  const asciiFileName = fileName.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\\r\n]/g, "_")

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}
