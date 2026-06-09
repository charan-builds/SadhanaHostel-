"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/lib/auth"
import { queryKeys } from "@/lib/react-query"
import { platformSdk } from "@/sdk"
import type {
  BootstrapAdminTenantInput,
  HostelCreateInput,
  HostelUpdateInput,
  UpdateOrganizationInput,
} from "@/validations/platform.validation"

export function useSetupStatus() {
  const scope = usePlatformScope()

  return useQuery({
    queryKey: queryKeys.platform.setupStatus(scope),
    queryFn: () => platformSdk.setupStatus(),
    retry: false,
  })
}

export function useBootstrapAdminTenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: BootstrapAdminTenantInput) => platformSdk.bootstrap(input),
    onSuccess: async (result) => {
      const scope = { organizationId: result.organization.id }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.session }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.setupStatus(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.organization(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.hostels(scope) }),
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "tenant" && query.queryKey[3] === "platform",
        }),
      ])
    },
  })
}

export function useOrganizationSettings(enabled = true) {
  const scope = usePlatformScope()

  return useQuery({
    queryKey: queryKeys.platform.organization(scope),
    queryFn: () => platformSdk.organization(),
    enabled: Boolean(enabled && scope.organizationId),
  })
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) =>
      platformSdk.updateOrganization(input),
    onSuccess: async (organization) => {
      const scope = { organizationId: organization.id }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.organization(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.setupStatus(scope) }),
      ])
    },
  })
}

export function useHostels(enabled = true) {
  const scope = usePlatformScope()

  return useQuery({
    queryKey: queryKeys.platform.hostels(scope),
    queryFn: () => platformSdk.hostels(),
    enabled: Boolean(enabled && scope.organizationId),
  })
}

export function useCreateHostel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: HostelCreateInput) => platformSdk.createHostel(input),
    onSuccess: async (hostel) => {
      const scope = { organizationId: hostel.organization_id }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.hostels(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.setupStatus(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.session }),
      ])
    },
  })
}

export function useUpdateHostel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: HostelUpdateInput) => platformSdk.updateHostel(input),
    onSuccess: async (hostel) => {
      const scope = { organizationId: hostel.organization_id }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.hostels(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.setupStatus(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.session }),
      ])
    },
  })
}

function usePlatformScope() {
  const { organizationId } = useAuth()

  return { organizationId }
}
