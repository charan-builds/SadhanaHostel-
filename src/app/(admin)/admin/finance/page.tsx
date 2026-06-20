import { AdminFinanceClient } from "@/components/admin/finance/admin-finance-client"

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ residentId?: string }>
}) {
  const { residentId } = await searchParams

  return <AdminFinanceClient initialResidentId={residentId} />
}
