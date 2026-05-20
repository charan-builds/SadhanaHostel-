import type { Route } from "next"
import type { LucideIcon } from "lucide-react"

export type NavItem<T extends string = string> = {
  title: string
  href: Route<T>
  description?: string
  icon?: LucideIcon
}
