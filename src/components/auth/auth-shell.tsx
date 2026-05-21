import Link from "next/link"
import type { ReactNode } from "react"

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
    <main className="flex min-h-svh bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-xl border bg-background shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden bg-slate-950 p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-white text-sm font-semibold text-slate-950">
                SB
              </span>
              <span>
                <span className="block text-sm font-semibold">{hostelConfig.name}</span>
                <span className="block text-xs text-slate-300">{hostelConfig.location.city}</span>
              </span>
            </Link>

            <div className="mt-14 max-w-md">
              <p className="text-sm font-medium text-blue-200">Hostel ERP</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                Secure operations for residents, fees, leaves, and rooms.
              </h1>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Admins and residents use the same tenant-safe platform with role-aware access and
                production API contracts.
              </p>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-slate-300">
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
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>

            <div className="mt-8">{children}</div>
          </div>
        </section>
      </div>
    </main>
  )
}
