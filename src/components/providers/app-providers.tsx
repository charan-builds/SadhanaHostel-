import type { ReactNode } from "react"

import { AppClientEnhancements } from "./app-client-enhancements"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AppClientEnhancements />
    </>
  )
}
