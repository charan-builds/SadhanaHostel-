import type { ReactNode } from "react"

import { SessionProviders } from "@/components/providers/app-providers"
import { RouteTransition } from "@/components/shared/route-transition"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProviders>
      <RouteTransition>{children}</RouteTransition>
    </SessionProviders>
  )
}
