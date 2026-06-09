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
export type EmployeeAccommodationRoomRow = Tables<"employee_accommodation_rooms">
export type GalleryWithDocumentRow = GalleryRow & {
  document?: Pick<Tables<"documents">, "id" | "bucket_name" | "storage_path"> | null
}
export type WebsiteCmsStatus = Database["public"]["Enums"]["cms_status_enum"]

type WebsiteScopedFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  status?: WebsiteCmsStatus
}

type LoadGalleryDocumentsOptions = {
  publicGalleryOnly?: boolean
}

export type ListWebsiteSettingsFilters = WebsiteScopedFilters & {
  sectionKey?: string
}

export type ListFacilitiesFilters = WebsiteScopedFilters & {
  highlightedOnly?: boolean
}

export type ListGalleryFilters = WebsiteScopedFilters & {
  category?: string
  categories?: string[]
}

export type ListEmployeeAccommodationRoomsFilters = WebsiteScopedFilters & {
  includeHidden?: boolean
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

  async getFacilityById(facilityId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("facilities")
      .select("*")
      .eq("id", facilityId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load facility.")
    }

    return data
  }

  async updateFacility(
    facilityId: string,
    organizationId: string,
    values: TablesUpdate<"facilities">
  ) {
    const { data, error } = await this.db
      .from("facilities")
      .update(values)
      .eq("id", facilityId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update facility.")
    }

    return data
  }

  async listGallery(
    filters: ListGalleryFilters
  ): Promise<PaginatedResult<GalleryWithDocumentRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)

    let query = this.db
      .from("gallery")
      .select("*", { count: "exact" })
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
    } else if (filters.categories && filters.categories.length > 0) {
      query = query.in("category", filters.categories)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list gallery items.")
    }

    const galleryRows = data ?? []
    const documentIds = Array.from(
      new Set(galleryRows.map((item) => item.document_id).filter(Boolean))
    )
    const documentsById = await this.loadGalleryDocuments(documentIds)

    return {
      data: galleryRows.map((item) => ({
        ...item,
        document: documentsById.get(item.document_id) ?? null,
      })),
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async loadGalleryDocuments(
    documentIds: string[],
    options: LoadGalleryDocumentsOptions = {}
  ) {
    const documentsById = new Map<
      string,
      Pick<Tables<"documents">, "id" | "bucket_name" | "storage_path">
    >()

    if (documentIds.length === 0) {
      return documentsById
    }

    let query = this.db
      .from("documents")
      .select("id,bucket_name,storage_path")
      .in("id", documentIds)

    if (options.publicGalleryOnly) {
      query = query
        .eq("bucket_name", "gallery-images")
        .eq("document_type", "gallery_image")
        .eq("is_public", true)
        .eq("is_active", true)
        .is("deleted_at", null)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load gallery documents.")
    }

    for (const document of data ?? []) {
      documentsById.set(document.id, document)
    }

    return documentsById
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

  async getGalleryItemById(galleryItemId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("gallery")
      .select("*")
      .eq("id", galleryItemId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load gallery item.")
    }

    return data
  }

  async updateGalleryItem(
    galleryItemId: string,
    organizationId: string,
    values: TablesUpdate<"gallery">
  ) {
    const { data, error } = await this.db
      .from("gallery")
      .update(values)
      .eq("id", galleryItemId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update gallery item.")
    }

    return data
  }

  async listEmployeeAccommodationRooms(
    filters: ListEmployeeAccommodationRoomsFilters
  ): Promise<PaginatedResult<EmployeeAccommodationRoomRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)

    let query = this.db
      .from("employee_accommodation_rooms")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (filters.hostelId) {
      query = query.or(`hostel_id.is.null,hostel_id.eq.${filters.hostelId}`)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (!filters.includeHidden) {
      query = query.eq("is_visible", true)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      if (
        error.code === "PGRST205" &&
        filters.status === "published" &&
        !filters.includeHidden
      ) {
        return {
          data: [],
          meta: createPaginationMeta(0, page, pageSize),
        }
      }

      throwRepositoryError(error, "Unable to list employee accommodation rooms.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async createEmployeeAccommodationRoom(
    values: TablesInsert<"employee_accommodation_rooms">
  ) {
    const { data, error } = await this.db
      .from("employee_accommodation_rooms")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create employee accommodation room.")
    }

    return data
  }

  async getEmployeeAccommodationRoomById(roomId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("employee_accommodation_rooms")
      .select("*")
      .eq("id", roomId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load employee accommodation room.")
    }

    return data
  }

  async updateEmployeeAccommodationRoom(
    roomId: string,
    organizationId: string,
    values: TablesUpdate<"employee_accommodation_rooms">
  ) {
    const { data, error } = await this.db
      .from("employee_accommodation_rooms")
      .update(values)
      .eq("id", roomId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update employee accommodation room.")
    }

    return data
  }
}
