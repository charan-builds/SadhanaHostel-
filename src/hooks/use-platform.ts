"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { platformSdk } from "@/sdk"
import type {
  BrandingUploadInput,
  BootstrapAdminTenantInput,
  HostelCreateInput,
  HostelUpdateInput,
  UpdateOrganizationInput,
} from "@/validations/platform.validation"
import type { UploadOptions } from "@/sdk/uploads.sdk"

export function useSetupStatus() {
  return useQuery({
    queryKey: queryKeys.platform.setupStatus,
    queryFn: () => platformSdk.setupStatus(),
    retry: false,
  })
}

export function useBootstrapAdminTenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: BootstrapAdminTenantInput) => platformSdk.bootstrap(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.session }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.setupStatus }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.organization }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.hostels }),
      ])
    },
  })
}

export function useOrganizationSettings(enabled = true) {
  return useQuery({
    queryKey: queryKeys.platform.organization,
    queryFn: () => platformSdk.organization(),
    enabled,
  })
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) =>
      platformSdk.updateOrganization(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.organization }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.setupStatus }),
      ])
    },
  })
}

export function useUploadBrandingImage() {
  return useMutation({
    mutationFn: ({
      input,
      file,
      options,
    }: {
      input: BrandingUploadInput
      file: File
      options?: UploadOptions
    }) => platformSdk.uploadBrandingImage(input, file, options),
  })
}

export function useHostels(enabled = true) {
  return useQuery({
    queryKey: queryKeys.platform.hostels,
    queryFn: () => platformSdk.hostels(),
    enabled,
  })
}

export function useCreateHostel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: HostelCreateInput) => platformSdk.createHostel(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.hostels }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.setupStatus }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.session }),
      ])
    },
  })
}

export function useUpdateHostel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: HostelUpdateInput) => platformSdk.updateHostel(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.hostels }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.setupStatus }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.session }),
      ])
    },
  })
}
