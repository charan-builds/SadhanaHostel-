import type { ReactNode } from "react"

import { FinanceSectionNav } from "@/components/admin/finance/finance-section-nav"

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FinanceSectionNav />
      {children}
    </>
  )
}
