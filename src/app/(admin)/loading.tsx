import { LoadingState } from "@/components/shared/loading-state"
import { BrandMark } from "@/components/shared/brand-mark"

export default function AdminLoading() {
  return (
    <div className="grid gap-6">
      <BrandMark className="size-10 animate-pulse" />
      <LoadingState variant="dashboard" />
    </div>
  )
}
