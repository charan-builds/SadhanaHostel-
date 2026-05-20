import { FileCheck2, ImageIcon, Upload } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { MockResident } from "@/types/frontend"

type ResidentDocumentsCardProps = {
  resident: MockResident
}

export function ResidentDocumentsCard({ resident }: ResidentDocumentsCardProps) {
  return (
    <section className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Documents</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Resident Uploads</h2>
        </div>
        <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <ImageIcon className="size-4 text-blue-700" aria-hidden="true" />
            <span className="text-sm font-medium">Profile photo</span>
          </div>
          <StatusBadge status="pending" />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <FileCheck2 className="size-4 text-blue-700" aria-hidden="true" />
            <span className="text-sm font-medium">Aadhaar document</span>
          </div>
          <StatusBadge status={resident.aadhaarNumber ? "approved" : "pending"} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <FileCheck2 className="size-4 text-blue-700" aria-hidden="true" />
            <span className="text-sm font-medium">Payment proof</span>
          </div>
          <StatusBadge status="pending" />
        </div>
      </div>

      <Button type="button" variant="outline" className="mt-5 w-full">
        Upload Placeholder
      </Button>
    </section>
  )
}
