import type { ReactNode } from "react"

import { SessionProviders } from "@/components/providers/app-providers"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <SessionProviders>{children}</SessionProviders>
}
