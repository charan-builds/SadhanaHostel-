"use client"

import { type ReactNode, useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { HOSTEL_FEES } from "@/constants/hostel"
import type { MockRoom } from "@/types/frontend"

const roomFormSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  floorNumber: z.string().min(1, "Floor number is required"),
  roomType: z.enum(["student", "employee", "mixed"], {
    error: "Room type is required",
  }),
  capacity: z.number().min(1, "Capacity must be at least 1"),
  monthlyFee: z.number().positive("Monthly fee is required"),
  hasAttachedBathroom: z.enum(["yes", "no"]),
  status: z.enum(["available", "full", "maintenance", "inactive"], {
    error: "Status is required",
  }),
  notes: z.string().optional(),
})

type RoomFormValues = z.infer<typeof roomFormSchema>

type RoomFormDialogProps = {
  room?: MockRoom
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function getDefaultValues(room?: MockRoom): RoomFormValues {
  return {
    roomNumber: room?.roomNumber ?? "",
    floorNumber: room?.floorNumber ?? "",
    roomType: room?.roomType ?? "student",
    capacity: room?.capacity ?? 1,
    monthlyFee: room?.monthlyFee ?? HOSTEL_FEES.student,
    hasAttachedBathroom: room?.hasAttachedBathroom ? "yes" : "no",
    status: room?.status ?? "available",
    notes: room?.notes ?? "",
  }
}

function feeForRoomType(roomType: RoomFormValues["roomType"]) {
  return roomType === "employee" ? HOSTEL_FEES.employee : HOSTEL_FEES.student
}

export function RoomFormDialog({ room, trigger, open, onOpenChange }: RoomFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [mockSubmitting, setMockSubmitting] = useState(false)
  const dialogOpen = open ?? internalOpen
  const setDialogOpen = onOpenChange ?? setInternalOpen

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: getDefaultValues(room),
  })

  useEffect(() => {
    reset(getDefaultValues(room))
  }, [reset, room])

  async function onSubmit() {
    setMockSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 650))
    setMockSubmitting(false)
    setDialogOpen(false)
    toast.success(room ? "Room changes saved in mock mode." : "Room saved in mock mode.")
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{room ? "Edit Room" : "Add Room"}</DialogTitle>
            <DialogDescription>
              Configure room details for the mock admin inventory. Backend save will be connected later.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="roomNumber">Room number</Label>
              <Input id="roomNumber" {...register("roomNumber")} placeholder="Example: S-204" />
              {errors.roomNumber ? (
                <p className="text-xs text-red-600">{errors.roomNumber.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="floorNumber">Floor number</Label>
              <Input id="floorNumber" {...register("floorNumber")} placeholder="Example: Second Floor" />
              {errors.floorNumber ? (
                <p className="text-xs text-red-600">{errors.floorNumber.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="roomType">Room type</Label>
              <Controller
                control={control}
                name="roomType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      const roomType = value as RoomFormValues["roomType"]
                      field.onChange(roomType)
                      setValue("monthlyFee", feeForRoomType(roomType), { shouldValidate: true })
                    }}
                  >
                    <SelectTrigger id="roomType" className="h-9 w-full">
                      <SelectValue placeholder="Select room type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.roomType ? <p className="text-xs text-red-600">{errors.roomType.message}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" type="number" min={1} {...register("capacity", { valueAsNumber: true })} />
              {errors.capacity ? (
                <p className="text-xs text-red-600">{errors.capacity.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="monthlyFee">Monthly fee</Label>
              <Input
                id="monthlyFee"
                type="number"
                min={1}
                {...register("monthlyFee", { valueAsNumber: true })}
              />
              {errors.monthlyFee ? (
                <p className="text-xs text-red-600">{errors.monthlyFee.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hasAttachedBathroom">Attached bathroom</Label>
              <Controller
                control={control}
                name="hasAttachedBathroom"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="hasAttachedBathroom" className="h-9 w-full">
                      <SelectValue placeholder="Bathroom facility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="status" className="h-9 w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.status ? <p className="text-xs text-red-600">{errors.status.message}</p> : null}
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register("notes")}
                placeholder="Room notes, allocation context, or maintenance details"
                className="min-h-24"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mockSubmitting}>
              {mockSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {room ? "Save Changes" : "Save Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
