import { AdminSetupWizardClient } from "@/components/admin/setup/admin-setup-wizard-client"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default function AdminSetupPage() {
  return <AdminSetupWizardClient />
}
