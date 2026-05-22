"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { websiteSdk } from "@/sdk"
import type {
  CreateFacilityInput,
  CreateGalleryItemInput,
  FacilitiesListInput,
  GalleryListInput,
  UpdateWebsiteSettingInput,
  UploadGalleryImageInput,
  WebsiteSettingsListInput,
} from "@/validations/website.validation"
import type { UploadOptions } from "@/sdk/uploads.sdk"

export function useWebsiteSettings(params: WebsiteSettingsListInput) {
  return useQuery({
    queryKey: queryKeys.website.settings(params, params),
    queryFn: () => websiteSdk.listSettings(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useUpdateWebsiteSetting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateWebsiteSettingInput) => websiteSdk.updateSetting(input),
    onSuccess: (setting) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.website.all({
          organizationId: setting.organization_id,
          hostelId: setting.hostel_id,
        }),
      })
    },
  })
}

export function useFacilities(params: FacilitiesListInput) {
  return useQuery({
    queryKey: queryKeys.website.facilities(params, params),
    queryFn: () => websiteSdk.listFacilities(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useCreateFacility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateFacilityInput) => websiteSdk.createFacility(input),
    onSuccess: (facility) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.website.all({
          organizationId: facility.organization_id,
          hostelId: facility.hostel_id,
        }),
      })
    },
  })
}

export function useGallery(params: GalleryListInput) {
  return useQuery({
    queryKey: queryKeys.website.gallery(params, params),
    queryFn: () => websiteSdk.listGallery(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useCreateGalleryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateGalleryItemInput) => websiteSdk.createGalleryItem(input),
    onSuccess: (item) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.website.all({
          organizationId: item.organization_id,
          hostelId: item.hostel_id,
        }),
      })
    },
  })
}

export function useUploadGalleryImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      input,
      file,
      options,
    }: {
      input: UploadGalleryImageInput
      file: File
      options?: UploadOptions
    }) => websiteSdk.uploadGalleryImage(input, file, options),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.website.all({
          organizationId: result.gallery.organization_id,
          hostelId: result.gallery.hostel_id,
        }),
      })
    },
  })
}
