import {
  Bell,
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  CreditCard,
  FileText,
  Globe,
  Home,
  Image as ImageIcon,
  Info,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Settings,
  ShieldCheck,
  User,
  UserRoundPlus,
  Users,
} from "lucide-react"
import type { Route } from "next"

import { hostelModules } from "@/config/hostel-modules"
import type { NavItem } from "@/types/navigation"

export const publicNavigation: NavItem[] = [
  { title: "Home", href: "/", icon: Home },
  { title: "About", href: "/about", icon: Info },
  { title: "Facilities", href: "/facilities", icon: ShieldCheck },
  { title: "Gallery", href: "/gallery", icon: ImageIcon },
  { title: "Contact", href: "/contact", icon: Mail },
  { title: "Support", href: "/support" as Route, icon: LifeBuoy },
  { title: "Terms", href: "/terms", icon: FileText },
]

export const adminNavigation: NavItem[] = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Owner Dashboard", href: "/admin/owner-dashboard" as Route, icon: BarChart3 },
  { title: "Leads", href: "/admin/leads" as Route, icon: UserRoundPlus },
  { title: "Residents", href: "/admin/residents", icon: Users },
  { title: "Payments", href: "/admin/payments", icon: CreditCard },
  { title: "Leaves", href: "/admin/leaves", icon: CalendarDays },
  { title: "Website", href: "/admin/website", icon: Globe },
  { title: "Notifications", href: "/admin/notifications", icon: Bell },
  { title: "Alerts", href: "/admin/alerts" as Route, icon: LifeBuoy },
  ...(hostelModules.launchReadiness
    ? [{ title: "Launch Readiness", href: "/admin/launch-readiness" as Route, icon: ClipboardCheck }]
    : []),
  { title: "Automation", href: "/admin/operations/automation" as Route, icon: Bot },
  { title: "Staff & Access", href: "/admin/settings/staff-access" as Route, icon: KeyRound },
  { title: "Settings", href: "/admin/settings", icon: Settings },
]

export const residentNavigation: NavItem[] = [
  { title: "Dashboard", href: "/resident/dashboard", icon: LayoutDashboard },
  { title: "Onboarding", href: "/resident/onboarding" as Route, icon: ShieldCheck },
  { title: "Profile", href: "/resident/profile", icon: User },
  { title: "Password", href: "/resident/security" as Route, icon: KeyRound },
  { title: "Payments", href: "/resident/payments", icon: CreditCard },
  { title: "Leave", href: "/resident/leave", icon: CalendarDays },
  { title: "Notices", href: "/resident/notices", icon: ClipboardList },
  { title: "Support", href: "/resident/support" as Route, icon: LifeBuoy },
]
