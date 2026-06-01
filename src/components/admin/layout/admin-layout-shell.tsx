import type { ReactNode } from "react"

import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs"
import { AdminSidebar } from "@/components/admin/layout/admin-sidebar"
import { AdminTopbar } from "@/components/admin/layout/admin-topbar"
import { AdminOperationalBanner } from "@/components/admin/support/admin-operational-banner"
import { RouteTransition } from "@/components/shared/route-transition"

type AdminLayoutShellProps = {
  children: ReactNode
}

export function AdminLayoutShell({ children }: AdminLayoutShellProps) {
  return (
    <div className="saas-grid-bg min-h-svh bg-background">
      <AdminSidebar />
      <div className="flex min-h-svh min-w-0 flex-col transition-[padding] duration-300 ease-out lg:pl-72 peer-data-[collapsed=true]/admin-sidebar:lg:pl-[88px]">
        <AdminTopbar />
        <main className="flex flex-1 flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <AdminBreadcrumbs />
          <AdminOperationalBanner />
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
    </div>
  )
}
