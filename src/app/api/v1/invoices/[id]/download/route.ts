import {
  getQueryParams,
  successResponse,
  withApiRoute,
} from "@/lib/api"
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
      const result = await service.createSignedDownloadUrl({
        ...getQueryParams(request),
        invoiceId: id,
      })

      return successResponse(result, "Invoice download URL generated.")
    }
  )
}
