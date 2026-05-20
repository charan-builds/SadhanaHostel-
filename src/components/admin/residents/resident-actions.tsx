"use client"

import { useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { CreditCard, Eye, Pencil, UserX } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import type { MockResident } from "@/types/frontend"

type ResidentActionsProps = {
  resident: MockResident
  context?: "table" | "detail"
}

export function ResidentActions({ resident, context = "table" }: ResidentActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isTable = context === "table"

  return (
    <div className="flex flex-wrap gap-2">
      {isTable ? (
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/residents/${resident.id}` as Route}>
            <Eye className="size-3.5" aria-hidden="true" />
            View
          </Link>
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => toast.info("Edit profile UI will be connected later.")}
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        {isTable ? "Edit" : "Edit Profile"}
      </Button>

      {!isTable ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => toast.info("Record payment UI will be connected later.")}
        >
          <CreditCard className="size-3.5" aria-hidden="true" />
          Record Payment
        </Button>
      ) : null}

      <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
        <UserX className="size-3.5" aria-hidden="true" />
        Deactivate
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Deactivate ${resident.name}?`}
        description="This is a frontend-only placeholder action. No resident record will be changed."
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={() => toast.success("Deactivate placeholder confirmed.")}
      />
    </div>
  )
}
