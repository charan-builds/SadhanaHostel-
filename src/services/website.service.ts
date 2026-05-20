import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/repositories/types"
import { WebsiteRepository } from "@/repositories/website.repository"
import type { Json } from "@/types/database"
import {
  createFacilitySchema,
  createGalleryItemSchema,
  facilitiesListSchema,
  galleryListSchema,
  updateWebsiteSettingSchema,
  websiteSettingsListSchema,
} from "@/validations/website.validation"

import { AuthService } from "./auth.service"

export class WebsiteService {
  private readonly authService: AuthService
  private readonly websiteRepository: WebsiteRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.websiteRepository = new WebsiteRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new WebsiteService(db)
  }

  async listSettings(input: unknown) {
    const values = websiteSettingsListSchema.parse(input)

    return this.websiteRepository.listSettings({
      ...values,
      status: values.status ?? "published",
    })
  }

  async updateSetting(input: unknown) {
    const values = updateWebsiteSettingSchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_ROLES)
    const publishedAt = values.status === "published" ? new Date().toISOString() : undefined

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.websiteRepository.updateSetting(values.settingId, values.organizationId, {
      title: values.title,
      content: values.content as Json | undefined,
      status: values.status,
      seo_title: values.seoTitle,
      seo_description: values.seoDescription,
      published_at: publishedAt,
      published_by: publishedAt ? context.authUser.id : undefined,
      updated_by: context.authUser.id,
    })
  }

  async listFacilities(input: unknown) {
    const values = facilitiesListSchema.parse(input)

    return this.websiteRepository.listFacilities({
      ...values,
      status: values.status ?? "published",
    })
  }

  async createFacility(input: unknown) {
    const values = createFacilitySchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_ROLES)
    const publishedAt = values.status === "published" ? new Date().toISOString() : null

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.websiteRepository.createFacility({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      name: values.name,
      slug: values.slug,
      description: values.description,
      icon_name: values.iconName,
      image_document_id: values.imageDocumentId,
      is_highlighted: values.isHighlighted,
      sort_order: values.sortOrder,
      status: values.status,
      published_at: publishedAt,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })
  }

  async listGallery(input: unknown) {
    const values = galleryListSchema.parse(input)

    return this.websiteRepository.listGallery({
      ...values,
      status: values.status ?? "published",
    })
  }

  async createGalleryItem(input: unknown) {
    const values = createGalleryItemSchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_ROLES)
    const publishedAt = values.status === "published" ? new Date().toISOString() : null

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.websiteRepository.createGalleryItem({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      document_id: values.documentId,
      title: values.title,
      description: values.description,
      alt_text: values.altText,
      category: values.category,
      sort_order: values.sortOrder,
      status: values.status,
      published_at: publishedAt,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })
  }
}
