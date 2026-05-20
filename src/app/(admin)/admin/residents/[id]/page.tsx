import { FileText } from "lucide-react"

import { ResidentActions } from "@/components/admin/residents/resident-actions"
import { ResidentDocumentsCard } from "@/components/admin/residents/resident-documents-card"
import { ResidentFeeSummary } from "@/components/admin/residents/resident-fee-summary"
import { ResidentProfileCard } from "@/components/admin/residents/resident-profile-card"
import { ResidentRoomSummary } from "@/components/admin/residents/resident-room-summary"
import { DataTableShell } from "@/components/shared/data-table-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { mockResidents, mockRooms, pendingLeaves, recentPayments } from "@/data/admin"

type ResidentDetailsPageProps = {
  params: Promise<{ id: string }>
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date?: string) {
  if (!date) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export default async function ResidentDetailsPage({ params }: ResidentDetailsPageProps) {
  const { id } = await params
  const resident = mockResidents.find((item) => item.id === id)

  if (!resident) {
    return (
      <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
        <PageHeader
          title="Resident Not Found"
          description="The selected mock resident record could not be found."
        />
        <EmptyState
          icon={FileText}
          title="No resident record"
          description="Choose a resident from the residents list to view details."
        />
      </ResponsiveContainer>
    )
  }

  const room = mockRooms.find((item) => item.roomNumber === resident.roomNumber)
  const residentPayments = recentPayments.filter((payment) => payment.residentName === resident.name)
  const residentLeaves = pendingLeaves.filter((leave) => leave.residentName === resident.name)

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title={resident.name}
        description="Resident profile, room allocation, fee status, documents, payments, and leave history."
        badge={resident.residentType}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={resident.status} />
            <ResidentActions resident={resident} context="detail" />
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ResidentProfileCard resident={resident} />
        <div className="grid gap-6">
          <ResidentRoomSummary resident={resident} room={room} />
          <ResidentFeeSummary resident={resident} payments={residentPayments} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <ResidentDocumentsCard resident={resident} />

        <DataTableShell
          title="Payment History"
          description="Recent payment activity for this resident."
          empty={
            residentPayments.length === 0 ? (
              <EmptyState
                title="No payment history"
                description="Payment history will appear here after records are connected."
              />
            ) : undefined
          }
        >
          {residentPayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {residentPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.month}</TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="capitalize">{payment.mode.replace("-", " ")}</TableCell>
                    <TableCell>
                      <StatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell>{formatDate(payment.paidOn ?? payment.dueDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </DataTableShell>
      </section>

      <DataTableShell
        title="Leave History Preview"
        description="Leave requests for this resident from mock data."
        empty={
          residentLeaves.length === 0 ? (
            <EmptyState
              title="No leave history"
              description="Leave requests for this resident will appear here."
            />
          ) : undefined
        }
      >
        {residentLeaves.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>Return</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Travel Mode</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {residentLeaves.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell>{formatDate(leave.fromDate)}</TableCell>
                  <TableCell>{formatDate(leave.toDate)}</TableCell>
                  <TableCell>{leave.reason}</TableCell>
                  <TableCell>{leave.travelMode ?? "Not specified"}</TableCell>
                  <TableCell>
                    <StatusBadge status={leave.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </DataTableShell>
    </ResponsiveContainer>
  )
}
