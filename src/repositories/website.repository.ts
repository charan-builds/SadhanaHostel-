import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database"

import {
  createPaginationMeta,
  normalizePagination,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
  type PaginationParams,
} from "./types"

export type WebsiteSettingRow = Tables<"website_settings">
export type FacilityRow = Tables<"facilities">
export type GalleryRow = Tables<"gallery">
export type GalleryWithDocumentRow = GalleryRow & {
  document?: Pick<Tables<"documents">, "bucket_name" | "storage_path"> | null
}
export type WebsiteCmsStatus = Database["public"]["Enums"]["cms_status_enum"]

type WebsiteScopedFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  status?: WebsiteCmsStatus
}

export type ListWebsiteSettingsFilters = WebsiteScopedFilters & {
  sectionKey?: string
}

export type ListFacilitiesFilters = WebsiteScopedFilters & {
  highlightedOnly?: boolean
}

export type ListGalleryFilters = WebsiteScopedFilters & {
  category?: string
}

export class WebsiteRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async listSettings(
    filters: ListWebsiteSettingsFilters
  ): Promise<PaginatedResult<WebsiteSettingRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)

    let query = this.db
      .from("website_settings")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("section_key", { ascending: true })

    if (filters.hostelId) {
      query = query.or(`hostel_id.is.null,hostel_id.eq.${filters.hostelId}`)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.sectionKey) {
      query = query.eq("section_key", filters.sectionKey)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list website settings.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async updateSetting(
    settingId: string,
    organizationId: string,
    values: TablesUpdate<"website_settings">
  ) {
    const { data, error } = await this.db
      .from("website_settings")
      .update(values)
      .eq("id", settingId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update website setting.")
    }

    return data
  }

  async getSettingById(settingId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("website_settings")
      .select("*")
      .eq("id", settingId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load website setting.")
    }

    return data
  }

  async listFacilities(
    filters: ListFacilitiesFilters
  ): Promise<PaginatedResult<FacilityRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)

    let query = this.db
      .from("facilities")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (filters.hostelId) {
      query = query.or(`hostel_id.is.null,hostel_id.eq.${filters.hostelId}`)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.highlightedOnly) {
      query = query.eq("is_highlighted", true)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list facilities.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async createFacility(values: TablesInsert<"facilities">) {
    const { data, error } = await this.db
      .from("facilities")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create facility.")
    }

    return data
  }

  async listGallery(
    filters: ListGalleryFilters
  ): Promise<PaginatedResult<GalleryWithDocumentRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)

    let query = this.db
      .from("gallery")
      .select("*, document:documents(bucket_name, storage_path)", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })

    if (filters.hostelId) {
      query = query.or(`hostel_id.is.null,hostel_id.eq.${filters.hostelId}`)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.category) {
      query = query.eq("category", filters.category)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list gallery items.")
    }

    return {
      data: (data ?? []) as GalleryWithDocumentRow[],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async createGalleryItem(values: TablesInsert<"gallery">) {
    const { data, error } = await this.db
      .from("gallery")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create gallery item.")
    }

    return data
  }
}
