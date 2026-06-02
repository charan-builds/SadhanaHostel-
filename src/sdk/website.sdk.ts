import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  CreateFacilityInput,
  CreateGalleryItemInput,
  DeleteGalleryItemInput,
  FacilitiesListInput,
  GalleryListInput,
  UpdateFacilityInput,
  UpdateWebsiteSettingInput,
  UploadGalleryImageInput,
  WebsiteSettingsListInput,
} from "@/validations/website.validation"

import type { PaginatedResult } from "./types"
import { uploadFile, type UploadOptions } from "./uploads.sdk"

export type GalleryItemView = Tables<"gallery"> & {
  imageUrl?: string | null
}

export type GalleryUploadResult = {
  gallery: GalleryItemView
  document: Tables<"documents">
}

export const websiteSdk = {
  listSettings(params: WebsiteSettingsListInput) {
    return apiClient.get<PaginatedResult<Tables<"website_settings">>>(
      "/api/website/settings",
      params
    )
  },

  updateSetting(input: UpdateWebsiteSettingInput) {
    return apiClient.patch<Tables<"website_settings">, UpdateWebsiteSettingInput>(
      "/api/website/settings",
      input
    )
  },

  listFacilities(params: FacilitiesListInput) {
    return apiClient.get<PaginatedResult<Tables<"facilities">>>(
      "/api/website/facilities",
      params
    )
  },

  createFacility(input: CreateFacilityInput) {
    return apiClient.post<Tables<"facilities">, CreateFacilityInput>(
      "/api/website/facilities",
      input
    )
  },

  updateFacility(input: UpdateFacilityInput) {
    return apiClient.patch<Tables<"facilities">, UpdateFacilityInput>(
      "/api/website/facilities",
      input
    )
  },

  listGallery(params: GalleryListInput) {
    return apiClient.get<PaginatedResult<GalleryItemView>>(
      "/api/website/gallery",
      params
    )
  },

  createGalleryItem(input: CreateGalleryItemInput) {
    return apiClient.post<Tables<"gallery">, CreateGalleryItemInput>(
      "/api/website/gallery",
      input
    )
  },

  deleteGalleryItem(input: DeleteGalleryItemInput) {
    return apiClient.delete<Tables<"gallery">>(
      `/api/website/gallery/${input.galleryItemId}`,
      {
        organizationId: input.organizationId,
      }
    )
  },

  uploadGalleryImage(
    input: UploadGalleryImageInput,
    file: File,
    options?: UploadOptions
  ) {
    return uploadFile<GalleryUploadResult>(
      "/api/website/gallery/upload",
      input,
      file,
      options
    )
  },
}
