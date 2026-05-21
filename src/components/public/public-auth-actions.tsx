"use client"

import Link from "next/link"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ADMIN_ROLES } from "@/constants/auth"
import { authSdk } from "@/sdk"
import { resolveHomeRoute, useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

type PublicAuthActionsProps = {
  mode?: "desktop" | "mobile"
  onNavigate?: () => void
  className?: string
}

export function PublicAuthActions({
  mode = "desktop",
  onNavigate,
  className,
}: PublicAuthActionsProps) {
  const router = useRouter()
  const { session, isLoading, refreshSession } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const isMobile = mode === "mobile"
  const authenticated = Boolean(session?.authenticated)
  const dashboardHref = resolveHomeRoute(session) as Route
  const isAdmin = Boolean(
    session?.roles.some((role) => (ADMIN_ROLES as readonly string[]).includes(role))
  )
  const dashboardLabel = isAdmin ? "Admin Dashboard" : "My Dashboard"

  async function logout() {
    try {
      setIsLoggingOut(true)
      await authSdk.logout()
      await refreshSession()
      onNavigate?.()
      router.push("/" as Route)
      toast.success("Signed out.")
    } catch {
      toast.error("Unable to sign out. Please try again.")
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (isLoading) {
    return (
      <Button
        variant="outline"
        size={isMobile ? "default" : "sm"}
        className={cn(isMobile && "w-full justify-start", className)}
        disabled
      >
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Checking session
      </Button>
    )
  }

  if (isMobile) {
    if (authenticated) {
      return (
        <div className={cn("grid gap-2", className)}>
          <Button asChild className="justify-start">
            <Link href={dashboardHref} onClick={onNavigate}>
              <LayoutDashboard className="size-4" aria-hidden="true" />
              {dashboardLabel}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            disabled={isLoggingOut}
            onClick={() => void logout()}
          >
            {isLoggingOut ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            Logout
          </Button>
        </div>
      )
    }

    return (
      <div className={cn("grid gap-2", className)}>
        <Button asChild className="justify-start">
          <Link href={"/login" as Route} onClick={onNavigate}>
            <LogIn className="size-4" aria-hidden="true" />
            Login
          </Link>
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="justify-start">
            <Link href={"/resident/login" as Route} onClick={onNavigate}>
              <UserRound className="size-4" aria-hidden="true" />
              Resident
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link href={"/admin/login" as Route} onClick={onNavigate}>
              <ShieldCheck className="size-4" aria-hidden="true" />
              Admin
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (authenticated) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={className}>
            <LayoutDashboard className="size-4" aria-hidden="true" />
            {dashboardLabel}
            <ChevronDown className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            {session?.profile?.full_name ?? session?.user?.email ?? "Signed in"}
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={dashboardHref}>
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Open {dashboardLabel}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={isLoggingOut}
            onClick={() => void logout()}
          >
            {isLoggingOut ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <LogIn className="size-4" aria-hidden="true" />
          Login
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Choose your portal</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={"/resident/login" as Route}>
            <UserRound className="size-4" aria-hidden="true" />
            Resident Portal
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={"/admin/login" as Route}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            Admin Portal
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={"/login" as Route}>
            <LogIn className="size-4" aria-hidden="true" />
            General Login
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
