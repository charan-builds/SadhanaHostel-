import type { ReactNode } from "react"

import { PublicFooter } from "@/components/public/public-footer"
import { PublicNavbar } from "@/components/public/public-navbar"

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicNavbar />
      <div className="flex flex-1 flex-col">{children}</div>
      <PublicFooter />
    </div>
  )
}
