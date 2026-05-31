"use client"

import { FileText } from "lucide-react"

import { DataTableShell } from "@/components/shared/data-table-shell"
import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/format"
import { useLeaves, usePayments, useResident } from "@/hooks"

export function ResidentDetailClient({ residentId }: { residentId: string }) {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const resident = useResident(residentId, organizationId ?? undefined)
  const payments = usePayments({
    organizationId: organizationId ?? "",
    hostelId,
    residentId,
    page: 1,
    pageSize: 20,
  })
  const leaves = useLeaves({
    organizationId: organizationId ?? "",
    hostelId,
    residentId,
    page: 1,
    pageSize: 20,
  })

  if (!organizationId) {
    return <EmptyState title="Tenant context resolving" message="Sadhana Boys Hostel context is being applied automatically." />
  }

  if (resident.isLoading) {
    return <LoadingState variant="cards" />
  }

  if (resident.error || !resident.data) {
    return (
      <APIErrorState
        title="Resident not found"
        message="The selected resident could not be loaded."
        onRetry={() => void resident.refetch()}
      />
    )
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title={resident.data.full_name}
        description="Resident profile, fee status, documents, payments, and leave history from production APIs."
        badge={resident.data.resident_type}
        actions={<StatusBadge status={resident.data.status} />}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <DetailCard label="Admission" value={resident.data.admission_number} />
        <DetailCard label="Phone" value={resident.data.phone ?? "-"} />
        <DetailCard label="Monthly Fee" value={formatCurrency(resident.data.monthly_fee_amount)} />
        <DetailCard label="Aadhaar" value={resident.data.aadhaar_document_id ? "Uploaded" : "Pending"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <h2 className="text-base font-semibold">Profile</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <InfoRow label="Email" value={resident.data.email ?? "-"} />
            <InfoRow label="Parent" value={resident.data.parent_name ?? "-"} />
            <InfoRow label="Parent phone" value={resident.data.parent_phone ?? "-"} />
            <InfoRow label="Emergency contact" value={resident.data.emergency_contact_phone ?? "-"} />
            <InfoRow label="Address" value={resident.data.permanent_address ?? "-"} />
          </dl>
        </div>

        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <h2 className="text-base font-semibold">Documents</h2>
          <div className="mt-4 grid gap-3">
            <DocumentRow icon={FileText} label="Aadhaar" uploaded={Boolean(resident.data.aadhaar_document_id)} />
            <DocumentRow icon={FileText} label="Profile photo" uploaded={Boolean(resident.data.profile_image_document_id)} />
          </div>
        </div>
      </section>

      <DataTableShell title="Payment History" description="Latest payment records for this resident.">
        {payments.isLoading ? (
          <LoadingState variant="table" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.data?.data.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.transaction_id ?? payment.manual_reference ?? payment.id.slice(0, 8)}</TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell className="capitalize">{payment.method.replace("_", " ")}</TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} />
                  </TableCell>
                  <TableCell>{formatDate(payment.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTableShell>

      <DataTableShell title="Leave History" description="Leave requests for this resident.">
        {leaves.isLoading ? (
          <LoadingState variant="table" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>Return</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Travel</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.data?.data.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell>{formatDate(leave.from_date)}</TableCell>
                  <TableCell>{formatDate(leave.to_date)}</TableCell>
                  <TableCell>{leave.reason}</TableCell>
                  <TableCell>{leave.travel_mode ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={leave.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTableShell>
    </ResponsiveContainer>
  )
}

function DetailCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold text-foreground">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}

function DocumentRow({
  icon: Icon,
  label,
  uploaded,
}: {
  icon: typeof FileText
  label: string
  uploaded: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <StatusBadge status={uploaded ? "verified" : "pending"} />
    </div>
  )
}
