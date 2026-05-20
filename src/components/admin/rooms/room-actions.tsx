"use client"

import { useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { BedDouble, Eye, Pencil, Wrench } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import type { MockRoom } from "@/types/frontend"

type RoomActionsProps = {
  room: MockRoom
  context?: "card" | "table" | "detail"
  onEdit?: () => void
}

export function RoomActions({ room, context = "table", onEdit }: RoomActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isDetail = context === "detail"

  return (
    <div className="flex flex-wrap gap-2">
      {!isDetail ? (
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/rooms/${room.id}` as Route}>
            <Eye className="size-3.5" aria-hidden="true" />
            View
          </Link>
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onEdit ?? (() => toast.info("Edit room UI will be connected later."))}
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        {isDetail ? "Edit Room" : "Edit"}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => toast.info("Room allocation UI will be connected later.")}
      >
        <BedDouble className="size-3.5" aria-hidden="true" />
        {isDetail ? "Allocate Resident" : "Allocate"}
      </Button>

      {isDetail ? (
        <>
          <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
            <Wrench className="size-3.5" aria-hidden="true" />
            Mark Maintenance
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={`Mark ${room.roomNumber} for maintenance?`}
            description="This is a frontend-only placeholder action. No room record will be changed."
            confirmLabel="Mark Maintenance"
            variant="danger"
            onConfirm={() => toast.success("Maintenance placeholder confirmed.")}
          />
        </>
      ) : null}
    </div>
  )
}
