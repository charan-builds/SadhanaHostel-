import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

import { BrandMark } from "@/components/shared/brand-mark"
import { MotionReveal } from "@/components/shared/motion-reveal"
import { hostelConfig } from "@/constants/hostel"

export function AuthShell({
  title,
  description,
  children,
  logoUrl,
}: {
  title: string
  description: string
  children: ReactNode
  logoUrl?: string | null
}) {
  return (
    <main className="saas-grid-bg flex min-h-svh bg-background px-4 py-8 sm:px-6">
      <MotionReveal className="mx-auto w-full max-w-6xl">
        <div className="saas-surface-strong grid w-full overflow-hidden rounded-xl lg:grid-cols-[0.9fr_1.1fr]">
          <section className="hidden overflow-hidden bg-sidebar p-8 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
            <div className="relative z-10">
              <Link
                href="/"
                className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
              >
                <BrandMark logoUrl={logoUrl} className="bg-sidebar-primary text-sidebar-primary-foreground shadow-lg" />
                <span>
                  <span className="block text-sm font-semibold">{hostelConfig.name}</span>
                  <span className="block text-xs text-sidebar-foreground/65">{hostelConfig.location.city}</span>
                </span>
              </Link>

              <div className="mt-18 grid min-h-72 place-items-center">
                <div className="relative">
                  <div className="absolute inset-0 animate-pulse rounded-[2rem] bg-sidebar-primary/25 blur-2xl" />
                  <div className="relative rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
                    <BrandMark logoUrl={logoUrl} className="size-24 rounded-3xl bg-sidebar-primary text-3xl text-sidebar-primary-foreground shadow-2xl" />
                  </div>
                  <div className="absolute -right-8 -top-8 size-16 rounded-full border border-white/15 bg-white/10" />
                  <div className="absolute -bottom-6 -left-10 size-24 rounded-full border border-sidebar-primary/30 bg-sidebar-primary/10" />
                </div>
              </div>
            </div>

            <div className="relative z-10 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-sidebar-primary" />
            </div>
          </section>

          <section className="flex min-h-[calc(100svh-4rem)] flex-col justify-center p-5 sm:p-8 lg:min-h-[680px] lg:p-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/"
                  className="inline-flex h-9 items-center gap-2 rounded-full border bg-background/80 px-3 text-sm font-medium text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Public website
                </Link>
                <Link href="/" className="inline-flex items-center gap-2 font-semibold lg:hidden">
                  <BrandMark logoUrl={logoUrl} className="size-9" />
                  {hostelConfig.shortName}
                </Link>
              </div>

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
