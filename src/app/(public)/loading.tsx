import { LoadingState } from "@/components/shared/loading-state"
import { BrandMark } from "@/components/shared/brand-mark"

export default function PublicLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <BrandMark className="mb-6 size-10 animate-pulse" />
      <LoadingState variant="cards" />
    </main>
  )
}
