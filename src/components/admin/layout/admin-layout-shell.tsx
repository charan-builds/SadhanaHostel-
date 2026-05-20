import type { ReactNode } from "react"

import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs"
import { AdminSidebar } from "@/components/admin/layout/admin-sidebar"
import { AdminTopbar } from "@/components/admin/layout/admin-topbar"

type AdminLayoutShellProps = {
  children: ReactNode
}

export function AdminLayoutShell({ children }: AdminLayoutShellProps) {
  return (
    <div className="min-h-svh bg-slate-50">
      <AdminSidebar />
      <div className="flex min-h-svh min-w-0 flex-col lg:pl-72">
        <AdminTopbar />
        <main className="flex flex-1 flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <AdminBreadcrumbs />
          {children}
        </main>
      </div>
    </div>
  )
}
