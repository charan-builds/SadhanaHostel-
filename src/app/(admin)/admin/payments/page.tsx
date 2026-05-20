import { WorkspacePage } from "@/components/shared/workspace-page"

export default function AdminPaymentsPage() {
  return (
    <WorkspacePage
      title="Payments"
      description="Fee schedules, dues, receipts, refunds, invoices, and future Cashfree reconciliation."
      metrics={[
        { label: "Collected", value: "0", detail: "Cash and gateway payments will be summarized here." },
        { label: "Outstanding", value: "0", detail: "Open invoices and overdue fees." },
        { label: "Receipts", value: "0", detail: "Generated receipt count." },
      ]}
      workItems={[
        {
          title: "Invoice generation",
          description: "Create invoice records with line items, tax support, receipt numbers, and PDF export later.",
          status: "Planned",
        },
        {
          title: "Cashfree integration",
          description: "Keep payment provider logic isolated behind service modules.",
          status: "Later",
        },
      ]}
    />
  )
}
