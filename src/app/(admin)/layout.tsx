import type { ReactNode } from "react"

import { AdminLayoutShell } from "@/components/admin/layout/admin-layout-shell"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>
}
