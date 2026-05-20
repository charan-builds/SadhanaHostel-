import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type ResponsiveContainerProps = {
  children: ReactNode
  className?: string
  size?: "default" | "wide" | "full"
}

const sizeClassName = {
  default: "max-w-7xl",
  wide: "max-w-screen-2xl",
  full: "max-w-none",
} as const

export function ResponsiveContainer({
  children,
  className,
  size = "default",
}: ResponsiveContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6", sizeClassName[size], className)}>
      {children}
    </div>
  )
}
