"use client"

import { Bell, LogOut, Search } from "lucide-react"

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

const mockAdminUser = {
  name: "Hostel Admin",
  role: "Admin",
  email: "admin@sadhanahostel.com",
} as const

export function AdminTopbar() {
  return (
    <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <AdminMobileSidebar />

        <div className="relative hidden min-w-0 flex-1 md:block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search residents, rooms, payments..."
            className="h-9 max-w-md bg-slate-50 pl-8"
            aria-label="Search admin workspace"
            readOnly
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Notifications">
            <Bell className="size-4" aria-hidden="true" />
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
                  <AvatarFallback>HA</AvatarFallback>
                </Avatar>
                <span className="hidden text-left md:block">
                  <span className="block text-sm font-medium leading-4">{mockAdminUser.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {mockAdminUser.email}
                  </span>
                </span>
                <Badge variant="secondary" className="hidden md:inline-flex">
                  {mockAdminUser.role}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <span className="block text-sm text-foreground">{mockAdminUser.name}</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {mockAdminUser.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="size-4" aria-hidden="true" />
                Logout placeholder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
