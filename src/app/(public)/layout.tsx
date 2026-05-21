import type { ReactNode } from "react"

import { PublicShell } from "@/components/layout/public-shell"
import { SessionProviders } from "@/components/providers/app-providers"

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProviders>
      <PublicShell>{children}</PublicShell>
    </SessionProviders>
  )
}
