"use client"

import { useMemo, useState } from "react"

import { ResidentActions } from "@/components/admin/residents/resident-actions"
import { DataTableShell } from "@/components/shared/data-table-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { SearchAndFilterBar } from "@/components/shared/search-and-filter-bar"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MockResident, PaymentStatus, ResidentStatus, ResidentType } from "@/types/frontend"

type ResidentsTableProps = {
  residents: MockResident[]
}

type ResidentTypeFilter = "all" | ResidentType
type ResidentStatusFilter = "all" | Extract<ResidentStatus, "active" | "inactive" | "left" | "suspended">
type PaymentStatusFilter = "all" | Extract<PaymentStatus, "paid" | "pending" | "partial" | "verification_pending">

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function ResidentsTable({ residents }: ResidentsTableProps) {
  const [searchValue, setSearchValue] = useState("")
  const [residentType, setResidentType] = useState<ResidentTypeFilter>("all")
  const [residentStatus, setResidentStatus] = useState<ResidentStatusFilter>("all")
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>("all")

  const filteredResidents = useMemo(() => {
    const search = searchValue.trim().toLowerCase()

    return residents.filter((resident) => {
      const matchesSearch =
        search.length === 0 ||
        resident.name.toLowerCase().includes(search) ||
        resident.phone.includes(search) ||
        resident.roomNumber.toLowerCase().includes(search)

      const matchesType = residentType === "all" || resident.residentType === residentType
      const matchesStatus = residentStatus === "all" || resident.status === residentStatus
      const matchesPayment = paymentStatus === "all" || resident.paymentStatus === paymentStatus

      return matchesSearch && matchesType && matchesStatus && matchesPayment
    })
  }, [paymentStatus, residentStatus, residentType, residents, searchValue])

  return (
    <DataTableShell
      title="Resident Records"
      description="Search, filter, and review resident records from mock frontend data."
      empty={
        filteredResidents.length === 0 ? (
          <EmptyState
            title="No residents found"
            description="Try changing the search query or selected filters."
          />
        ) : undefined
      }
    >
      <div className="border-b p-4">
        <SearchAndFilterBar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search by name, phone, or room"
          filters={
            <>
              <Select
                value={residentType}
                onValueChange={(value) => setResidentType(value as ResidentTypeFilter)}
              >
                <SelectTrigger aria-label="Filter by resident type" className="h-9 min-w-36">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={residentStatus}
                onValueChange={(value) => setResidentStatus(value as ResidentStatusFilter)}
              >
                <SelectTrigger aria-label="Filter by resident status" className="h-9 min-w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={paymentStatus}
                onValueChange={(value) => setPaymentStatus(value as PaymentStatusFilter)}
              >
                <SelectTrigger aria-label="Filter by payment status" className="h-9 min-w-44">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="verification_pending">Verification pending</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
        />
      </div>

      {filteredResidents.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Resident</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Fee Amount</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Resident Status</TableHead>
              <TableHead>Joining Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResidents.map((resident) => (
              <TableRow key={resident.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{resident.name}</p>
                    <p className="text-xs text-muted-foreground">{resident.id}</p>
                  </div>
                </TableCell>
                <TableCell className="capitalize">{resident.residentType}</TableCell>
                <TableCell>{resident.phone}</TableCell>
                <TableCell>{resident.roomNumber}</TableCell>
                <TableCell>{formatCurrency(resident.feeAmount)}</TableCell>
                <TableCell>
                  <StatusBadge status={resident.paymentStatus} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={resident.status} />
                </TableCell>
                <TableCell>{formatDate(resident.joiningDate)}</TableCell>
                <TableCell>
                  <ResidentActions resident={resident} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </DataTableShell>
  )
}
