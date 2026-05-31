import Link from "next/link"
import type { ReactNode } from "react"

import { MotionReveal } from "@/components/shared/motion-reveal"
import { hostelConfig } from "@/constants/hostel"

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="saas-grid-bg flex min-h-svh bg-background px-4 py-8 sm:px-6">
      <MotionReveal className="mx-auto w-full max-w-6xl">
      <div className="saas-surface-strong grid w-full overflow-hidden rounded-xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden bg-sidebar p-8 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground shadow-lg">
                SB
              </span>
              <span>
                <span className="block text-sm font-semibold">{hostelConfig.name}</span>
                <span className="block text-xs text-sidebar-foreground/65">{hostelConfig.location.city}</span>
              </span>
            </Link>

            <div className="mt-14 max-w-md">
              <p className="text-sm font-medium text-sidebar-primary">Hostel ERP</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                Secure operations for residents, fees, leaves, and rooms.
              </h1>
              <p className="mt-4 text-sm leading-6 text-sidebar-foreground/68">
                Admins and residents use the same tenant-safe platform with role-aware access and
                production API contracts.
              </p>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-sidebar-foreground/68">
            <p>Tenant-isolated access</p>
            <p>Secure Supabase Auth sessions</p>
            <p>Resident-first mobile workflows</p>
          </div>
        </section>

        <section className="flex min-h-[680px] flex-col justify-center p-5 sm:p-8 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <Link href="/" className="mb-8 inline-flex items-center gap-2 font-semibold lg:hidden">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
                SB
              </span>
              {hostelConfig.shortName}
            </Link>

            <div>
              <h1 className="text-gradient text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>

            <div className="mt-8">{children}</div>
          </div>
        </section>
      </div>
      </MotionReveal>
    </main>
  )
}
