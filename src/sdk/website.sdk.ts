import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  CreateFacilityInput,
  CreateGalleryItemInput,
  FacilitiesListInput,
  GalleryListInput,
  UpdateWebsiteSettingInput,
  WebsiteSettingsListInput,
} from "@/validations/website.validation"

import type { PaginatedResult } from "./types"

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

  listGallery(params: GalleryListInput) {
    return apiClient.get<PaginatedResult<Tables<"gallery">>>(
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
}
