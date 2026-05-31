import { PaymentSecurityClient } from "@/components/admin/payments/payment-security-client"
import { requireProtectedRoute } from "@/lib/auth/server-route-guard"

export default async function AdminPaymentSecurityPage() {
  const context = await requireProtectedRoute("admin")

  return (
    <PaymentSecurityClient
      organizationId={context.organizationId}
      hostelId={context.hostelIds[0] ?? null}
    />
  )
}
