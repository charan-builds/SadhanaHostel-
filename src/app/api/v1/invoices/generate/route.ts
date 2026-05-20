import {
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { InvoicesService } from "@/services/invoices"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "v1.invoices.generate",
    },
    async () => {
      const service = await InvoicesService.create()
      const invoice = await service.generateMonthlyFeeInvoice(await parseJsonBody(request))

      return successResponse(invoice, "Invoice generated successfully.")
    }
  )
}
