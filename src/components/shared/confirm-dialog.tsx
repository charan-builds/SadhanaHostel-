"use client"

import { useState } from "react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { APIErrorState } from "@/components/system"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "danger"
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const [error, setError] = useState<unknown>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleConfirm() {
    setError(null)
    setIsPending(true)

    try {
      await onConfirm()
      onOpenChange(false)
    } catch (confirmError) {
      setError(confirmError)
    } finally {
      setIsPending(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setError(null)
    }

    if (!isPending) {
      onOpenChange(nextOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {error ? (
          <APIErrorState
            title="Action failed"
            error={error}
            message={error instanceof Error ? error.message : "The action could not be completed."}
          />
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={variant === "danger" ? "destructive" : "default"}
            disabled={isPending}
            onClick={() => void handleConfirm()}
          >
            {isPending ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
