import { IdCard, Phone, UserRound } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import type { MockResident } from "@/types/frontend"

type ResidentProfileCardProps = {
  resident: MockResident
}

function maskAadhaar(aadhaar?: string) {
  if (!aadhaar) {
    return "Not provided"
  }

  return `XXXX XXXX ${aadhaar.slice(-4)}`
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value || "Not provided"}</p>
    </div>
  )
}

export function ResidentProfileCard({ resident }: ResidentProfileCardProps) {
  return (
    <section className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <UserRound className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{resident.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={resident.status} />
              <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                {resident.residentType}
              </span>
            </div>
          </div>
        </div>
        <IdCard className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <DetailRow label="Phone" value={resident.phone} />
        <DetailRow label="WhatsApp" value={resident.whatsappNumber ?? resident.phone} />
        <DetailRow label="Aadhaar" value={maskAadhaar(resident.aadhaarNumber)} />
        <DetailRow label="Parent Name" value={resident.parentName} />
        <DetailRow label="Parent Phone" value={resident.parentPhone} />
        <DetailRow label="Emergency Contact" value={resident.emergencyContact} />
        <DetailRow label="Joining Date" value={resident.joiningDate} />
      </div>

      <div className="mt-5 rounded-lg border bg-slate-50 p-3">
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{resident.notes ?? "No resident notes added yet."}</p>
        </div>
      </div>
    </section>
  )
}
