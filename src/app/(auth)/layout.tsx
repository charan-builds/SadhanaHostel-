import type { ReactNode } from "react"
import type { Metadata } from "next"

import { SessionProviders } from "@/components/providers/app-providers"
import { RouteTransition } from "@/components/shared/route-transition"
import { noIndexMetadata } from "@/lib/seo"

export const metadata: Metadata = noIndexMetadata

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProviders>
      <RouteTransition>{children}</RouteTransition>
    </SessionProviders>
  )
}
