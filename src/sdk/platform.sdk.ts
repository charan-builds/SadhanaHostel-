import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  BootstrapAdminTenantInput,
  HostelCreateInput,
  HostelUpdateInput,
  UpdateOrganizationInput,
} from "@/validations/platform.validation"

export type SetupStatus = {
  setupRequired: boolean
  missing: Array<"organization" | "hostel" | "hostel_scope">
  organization: Tables<"organizations"> | null
  hostels: Tables<"hostels">[]
  activeHostel: Tables<"hostels"> | null
}

export type BootstrapTenantResult = {
  organization: Tables<"organizations">
  hostel: Tables<"hostels">
}

export const platformSdk = {
  setupStatus() {
    return apiClient.get<SetupStatus>("/api/platform/setup-status")
  },

  bootstrap(input: BootstrapAdminTenantInput) {
    return apiClient.post<BootstrapTenantResult, BootstrapAdminTenantInput>(
      "/api/platform/bootstrap",
      input,
      { retry: 0 }
    )
  },

  organization() {
    return apiClient.get<Tables<"organizations">>("/api/platform/organization")
  },

  updateOrganization(input: UpdateOrganizationInput) {
    return apiClient.patch<Tables<"organizations">, UpdateOrganizationInput>(
      "/api/platform/organization",
      input
    )
  },

  hostels() {
    return apiClient.get<Tables<"hostels">[]>("/api/platform/hostels")
  },

  createHostel(input: HostelCreateInput) {
    return apiClient.post<Tables<"hostels">, HostelCreateInput>(
      "/api/platform/hostels",
      input
    )
  },

  updateHostel(input: HostelUpdateInput) {
    const { hostelId, ...body } = input

    return apiClient.patch<Tables<"hostels">, Omit<HostelUpdateInput, "hostelId">>(
      `/api/platform/hostels/${hostelId}`,
      body
    )
  },
}
