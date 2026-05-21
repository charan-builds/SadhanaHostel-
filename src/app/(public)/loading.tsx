import { LoadingState } from "@/components/shared/loading-state"

export default function PublicLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <LoadingState variant="cards" />
    </main>
  )
}
