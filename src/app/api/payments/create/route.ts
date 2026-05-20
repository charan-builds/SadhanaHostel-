import {
  createdResponse,
  errorResponse,
  parseJsonBody,
} from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const service = await PaymentsService.create()
    const payment = await service.createUpiPayment(await parseJsonBody(request))

    return createdResponse(payment, "UPI payment submitted for verification.")
  } catch (error) {
    return errorResponse(error)
  }
}
