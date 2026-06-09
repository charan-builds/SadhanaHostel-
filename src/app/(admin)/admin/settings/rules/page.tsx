import { AdminHostelRulesClient } from "@/components/admin/settings/admin-hostel-rules-client"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default function AdminRulesSettingsPage() {
  return <AdminHostelRulesClient />
}
