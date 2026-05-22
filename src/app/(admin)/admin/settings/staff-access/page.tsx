import { AdminStaffAccessClient } from "@/components/admin/staff-access/admin-staff-access-client"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default function AdminStaffAccessPage() {
  return <AdminStaffAccessClient />
}
