import type { ReactNode } from "react"

import { AdminLayoutShell } from "@/components/admin/layout/admin-layout-shell"
import { RouteGuard } from "@/lib/auth"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RouteGuard area="admin">
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </RouteGuard>
  )
}
