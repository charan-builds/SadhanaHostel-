import type { ReactNode } from "react"
import type { Metadata } from "next"

import { SessionProviders } from "@/components/providers/session-providers"
import { noIndexMetadata } from "@/lib/seo"

export const metadata: Metadata = noIndexMetadata

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProviders loadSessionOnMount={false}>
      {children}
    </SessionProviders>
  )
}
