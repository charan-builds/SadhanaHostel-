"use client"

import { usePathname } from "next/navigation"

function formatSegment(segment: string) {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function AdminBreadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments[0] !== "admin") {
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {segments.map((segment, index) => (
          <li key={`${segment}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            <span className={index === segments.length - 1 ? "font-medium text-foreground" : undefined}>
              {formatSegment(segment)}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}
