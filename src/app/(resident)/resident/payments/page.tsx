import { WorkspacePage } from "@/components/shared/workspace-page"

export default function ResidentPaymentsPage() {
  return (
    <WorkspacePage
      title="Payments"
      description="Resident fee schedule, invoices, receipts, dues, and online payment actions."
      metrics={[
        { label: "Due", value: "0", detail: "Open fee amount after invoices are generated." },
        { label: "Paid", value: "0", detail: "Confirmed payments." },
        { label: "Receipts", value: "0", detail: "Downloadable receipts after invoice setup." },
      ]}
      workItems={[
        {
          title: "Invoice list",
          description: "Residents can view invoices, due dates, status, and receipt history.",
          status: "Planned",
        },
        {
          title: "Online payment",
          description: "Cashfree checkout will be added after payment entities are finalized.",
          status: "Later",
        },
      ]}
    />
  )
}
