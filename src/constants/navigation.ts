import {
  Bell,
  BedDouble,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  Home,
  Image as ImageIcon,
  Info,
  KeyRound,
  LayoutDashboard,
  Mail,
  Settings,
  ShieldCheck,
  User,
  UserRoundPlus,
  Users,
} from "lucide-react"
import type { Route } from "next"

import type { NavItem } from "@/types/navigation"

export const publicNavigation: NavItem[] = [
  { title: "Home", href: "/", icon: Home },
  { title: "About", href: "/about", icon: Info },
  { title: "Rooms", href: "/rooms", icon: Building2 },
  { title: "Facilities", href: "/facilities", icon: ShieldCheck },
  { title: "Gallery", href: "/gallery", icon: ImageIcon },
  { title: "Contact", href: "/contact", icon: Mail },
  { title: "Terms", href: "/terms", icon: FileText },
]

export const adminNavigation: NavItem[] = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Leads", href: "/admin/leads" as Route, icon: UserRoundPlus },
  { title: "Reservations", href: "/admin/reservations" as Route, icon: CalendarCheck },
  { title: "Vacancy", href: "/admin/vacancy" as Route, icon: BedDouble },
  { title: "Residents", href: "/admin/residents", icon: Users },
  { title: "Payments", href: "/admin/payments", icon: CreditCard },
  { title: "Rooms", href: "/admin/rooms", icon: Building2 },
  { title: "Leaves", href: "/admin/leaves", icon: CalendarDays },
  { title: "Website", href: "/admin/website", icon: Globe },
  { title: "Notifications", href: "/admin/notifications", icon: Bell },
  { title: "Staff & Access", href: "/admin/settings/staff-access" as Route, icon: KeyRound },
  { title: "Settings", href: "/admin/settings", icon: Settings },
]

export const residentNavigation: NavItem[] = [
  { title: "Dashboard", href: "/resident/dashboard", icon: LayoutDashboard },
  { title: "Onboarding", href: "/resident/onboarding" as Route, icon: ShieldCheck },
  { title: "Profile", href: "/resident/profile", icon: User },
  { title: "Payments", href: "/resident/payments", icon: CreditCard },
  { title: "Leave", href: "/resident/leave", icon: CalendarDays },
  { title: "Notices", href: "/resident/notices", icon: ClipboardList },
]
