import { AdminSettingsClient } from "@/components/admin/settings/admin-settings-client"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default function AdminSettingsPage() {
  return <AdminSettingsClient />
}
