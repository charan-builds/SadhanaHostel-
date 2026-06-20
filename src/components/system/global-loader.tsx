import { BrandMark } from "@/components/shared/brand-mark"

export function GlobalLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <BrandMark className="size-12 animate-pulse" />
        <span>{label}</span>
      </div>
    </div>
  )
}
