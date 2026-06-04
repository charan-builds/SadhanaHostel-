"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Bell, LogOut, Search } from "lucide-react"
import { toast } from "sonner"

import { AdminMobileSidebar } from "@/components/admin/layout/admin-mobile-sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth"
import { humanizeEnum } from "@/lib/format"
import { authSdk } from "@/sdk"

export function AdminTopbar({ logoUrl }: { logoUrl?: string | null }) {
  const router = useRouter()
  const { session, refreshSession } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const profile = session?.profile
  const displayName = profile?.full_name ?? session?.user?.email ?? "Admin"
  const displayEmail = profile?.email ?? session?.user?.email ?? "Signed in"
  const roleLabel = session?.primaryRole ? humanizeEnum(session.primaryRole) : "Admin"
  const initials = useMemo(
    () =>
      displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "A",
    [displayName]
  )

  async function logout() {
    setIsLoggingOut(true)

    try {
      await authSdk.logout()
      await refreshSession()
      router.replace("/admin/login" as Route)
    } catch {
      toast.error("Logout failed. Please try again.")
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/70 bg-white/78 shadow-sm shadow-slate-950/5 backdrop-blur-2xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <AdminMobileSidebar logoUrl={logoUrl} />

        <div className="relative hidden min-w-0 flex-1 md:block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search residents, payments, notices..."
            className="h-10 max-w-md bg-white/70 pl-8"
            aria-label="Search admin workspace"
            readOnly
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Operational alerts">
            <Link href={"/admin/alerts" as Route}>
              <Bell className="size-4" aria-hidden="true" />
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-10 gap-3 px-2"
                aria-label="Open admin profile menu"
              >
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden text-left md:block">
                  <span className="block text-sm font-medium leading-4">{displayName}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {displayEmail}
                  </span>
                </span>
                <Badge variant="secondary" className="hidden md:inline-flex">
                  {roleLabel}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <span className="block text-sm text-foreground">{displayName}</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {displayEmail}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={isLoggingOut} onClick={() => void logout()}>
                <LogOut className="size-4" aria-hidden="true" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
