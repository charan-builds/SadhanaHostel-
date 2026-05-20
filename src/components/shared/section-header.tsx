import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type SectionHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  align?: "left" | "center"
  className?: string
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  align = "left",
  className,
}: SectionHeaderProps) {
  const centered = align === "center"

  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        centered && "items-center text-center md:flex-col md:items-center",
        className,
      )}
    >
      <div className={cn("max-w-3xl", centered && "mx-auto")}>
        {eyebrow ? <p className="text-sm font-medium text-blue-700">{eyebrow}</p> : null}
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground text-balance md:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
