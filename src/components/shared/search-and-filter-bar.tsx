"use client"

import type { ReactNode } from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SearchAndFilterBarProps = {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filters?: ReactNode
  actions?: ReactNode
  className?: string
}

export function SearchAndFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search",
  filters,
  actions,
  className,
}: SearchAndFilterBarProps) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-background p-3 md:flex-row md:items-center", className)}>
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{searchPlaceholder}</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 pl-8"
          type="search"
        />
      </label>
      {filters ? <div className="flex flex-wrap gap-2">{filters}</div> : null}
      {actions ? <div className="flex flex-wrap gap-2 md:ml-auto">{actions}</div> : null}
    </div>
  )
}
