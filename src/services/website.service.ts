import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { badRequest, notFound } from "@/lib/api/api-error"
import {
  buildTenantCacheKey,
  getOrSetCache,
  invalidateCacheByTag,
} from "@/lib/cache"
import { logAuditEvent } from "@/lib/logger"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/repositories/types"
import { UploadsRepository } from "@/repositories/uploads.repository"
import { WebsiteRepository } from "@/repositories/website.repository"
import type { Json } from "@/types/database"
import {
  createFacilitySchema,
  createGalleryItemSchema,
  facilitiesListSchema,
  galleryListSchema,
  updateWebsiteSettingSchema,
  uploadGalleryImageSchema,
  websiteSettingsListSchema,
} from "@/validations/website.validation"

import { AuthService } from "./auth.service"

const GALLERY_BUCKET = "gallery-images"
const MAX_GALLERY_IMAGE_BYTES = 6 * 1024 * 1024
const GALLERY_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export type WebsiteGalleryItemView =
  Awaited<ReturnType<WebsiteRepository["listGallery"]>>["data"][number] & {
    imageUrl: string | null
  }

export class WebsiteService {
  private readonly authService: AuthService
  private readonly uploadsRepository: UploadsRepository
  private readonly websiteRepository: WebsiteRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.uploadsRepository = new UploadsRepository(db)
    this.websiteRepository = new WebsiteRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new WebsiteService(db)
  }

  async listSettings(input: unknown) {
    const values = websiteSettingsListSchema.parse(input)

    return getOrSetCache(
      buildTenantCacheKey({
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        scope: "cms",
        identifier: `settings:${values.sectionKey ?? "all"}:${values.status ?? "published"}`,
      }),
      {
        ttlMs: 60_000,
        tags: [`tenant:${values.organizationId}:cms`],
      },
      () =>
        this.websiteRepository.listSettings({
          ...values,
          status: values.status ?? "published",
        })
    )
  }

  async updateSetting(input: unknown) {
    const values = updateWebsiteSettingSchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_ROLES)
    const publishedAt = values.status === "published" ? new Date().toISOString() : undefined
    const existingSetting = await this.websiteRepository.getSettingById(
      values.settingId,
      values.organizationId
    )

    if (!existingSetting) {
      throw notFound("Website setting not found.")
    }

    this.authService.requireHostelAccess(
      context,
      existingSetting.organization_id,
      existingSetting.hostel_id
    )

    const setting = await this.websiteRepository.updateSetting(values.settingId, values.organizationId, {
      title: values.title,
      content: values.content as Json | undefined,
      status: values.status,
      seo_title: values.seoTitle,
      seo_description: values.seoDescription,
      published_at: publishedAt,
      published_by: publishedAt ? context.authUser.id : undefined,
      updated_by: context.authUser.id,
    })

    invalidateCacheByTag(`tenant:${values.organizationId}:cms`)

    return setting
  }

  async listFacilities(input: unknown) {
    const values = facilitiesListSchema.parse(input)

    return getOrSetCache(
      buildTenantCacheKey({
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        scope: "cms",
        identifier: `facilities:${values.highlightedOnly ? "highlighted" : "all"}:${values.status ?? "published"}`,
      }),
      {
        ttlMs: 60_000,
        tags: [`tenant:${values.organizationId}:cms`],
      },
      () =>
        this.websiteRepository.listFacilities({
          ...values,
          status: values.status ?? "published",
        })
    )
  }

  async createFacility(input: unknown) {
    const values = createFacilitySchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_ROLES)
    const publishedAt = values.status === "published" ? new Date().toISOString() : null
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    const facility = await this.websiteRepository.createFacility({
      organization_id: values.organizationId,
      hostel_id: hostelId,
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

    invalidateCacheByTag(`tenant:${values.organizationId}:cms`)

    return facility
  }

  async listGallery(input: unknown) {
    const values = galleryListSchema.parse(input)

    const gallery = await this.websiteRepository.listGallery({
      ...values,
      status: values.status ?? "published",
    })

    return {
      ...gallery,
      data: gallery.data.map((item) => ({
        ...item,
        imageUrl: item.document
          ? this.uploadsRepository.getPublicUrl(
              item.document.bucket_name,
              item.document.storage_path
            )
          : null,
      })),
    }
  }

  async createGalleryItem(input: unknown) {
    const values = createGalleryItemSchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_ROLES)
    const publishedAt = values.status === "published" ? new Date().toISOString() : null
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    const item = await this.websiteRepository.createGalleryItem({
      organization_id: values.organizationId,
      hostel_id: hostelId,
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

    invalidateCacheByTag(`tenant:${values.organizationId}:cms`)

    return item
  }

  async uploadGalleryImage(input: unknown, file: File) {
    const values = uploadGalleryImageSchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_ROLES)
    const publishedAt = values.status === "published" ? new Date().toISOString() : null
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    this.validateGalleryFile(file)

    const storagePath = this.buildGalleryStoragePath(
      values.organizationId,
      hostelId ?? undefined,
      file.name
    )

    await this.uploadsRepository.uploadObject(GALLERY_BUCKET, storagePath, file, {
      cacheControl: "31536000",
      upsert: false,
    })

    try {
      const checksum = await this.calculateChecksum(file)
      const document = await this.uploadsRepository.createDocument({
        organization_id: values.organizationId,
        hostel_id: hostelId,
        uploaded_by_user_id: context.authUser.id,
        document_type: "gallery_image",
        bucket_name: GALLERY_BUCKET,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        checksum,
        is_public: values.status === "published",
        status: "verified",
        created_by: context.authUser.id,
        updated_by: context.authUser.id,
      })
      const gallery = await this.websiteRepository.createGalleryItem({
        organization_id: values.organizationId,
        hostel_id: hostelId,
        document_id: document.id,
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

      invalidateCacheByTag(`tenant:${values.organizationId}:cms`)
      logAuditEvent({
        action: "cms.gallery.uploaded",
        actorUserId: context.authUser.id,
        organizationId: values.organizationId,
        targetTable: "gallery",
        targetId: gallery.id,
        outcome: "success",
        details: {
          hostelId: values.hostelId,
          effectiveHostelId: hostelId,
          documentId: document.id,
          bucketName: GALLERY_BUCKET,
          storagePath,
          status: values.status,
        },
      })

      return {
        gallery: {
          ...gallery,
          imageUrl: this.uploadsRepository.getPublicUrl(GALLERY_BUCKET, storagePath),
        },
        document,
      }
    } catch (error) {
      await this.uploadsRepository.removeObject(GALLERY_BUCKET, storagePath)
      throw error
    }
  }

  private validateGalleryFile(file: File) {
    if (!file || file.size === 0) {
      throw badRequest("A non-empty gallery image is required.")
    }

    if (file.size > MAX_GALLERY_IMAGE_BYTES) {
      throw badRequest("Gallery image is larger than the allowed upload size.")
    }

    if (!GALLERY_IMAGE_MIME_TYPES.has(file.type)) {
      throw badRequest("Gallery image must be a JPG, PNG, or WebP file.")
    }
  }

  private buildGalleryStoragePath(
    organizationId: string,
    hostelId: string | undefined,
    fileName: string
  ) {
    return `${organizationId}/${hostelId ?? "global"}/gallery/${crypto.randomUUID()}-${this.safeFileName(fileName)}`
  }

  private safeFileName(fileName: string) {
    const safeFileName = fileName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")

    return safeFileName || "image"
  }

  private async calculateChecksum(file: File) {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }
}
