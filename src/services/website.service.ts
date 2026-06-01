import "server-only"

import { badRequest, notFound } from "@/lib/api/api-error"
import {
  buildTenantCacheKey,
  getOrSetCache,
  invalidateCacheByTag,
} from "@/lib/cache"
import { logAuditEvent } from "@/lib/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AdmissionsRepository } from "@/repositories/admissions.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { UploadsRepository } from "@/repositories/uploads.repository"
import { WebsiteRepository } from "@/repositories/website.repository"
import type { Json } from "@/types/database"
import {
  createFacilitySchema,
  createGalleryItemSchema,
  facilitiesListSchema,
  galleryListSchema,
  updateFacilitySchema,
  updateWebsiteSettingSchema,
  uploadGalleryImageSchema,
  websiteSettingsListSchema,
} from "@/validations/website.validation"

import { AuthService } from "./auth.service"

const GALLERY_BUCKET = "gallery-images"
const MAX_GALLERY_IMAGE_BYTES = 6 * 1024 * 1024
const GALLERY_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

function versionedPublicUrl(url: string, version: string | null | undefined) {
  if (!version) {
    return url
  }

  const separator = url.includes("?") ? "&" : "?"

  return `${url}${separator}v=${encodeURIComponent(version)}`
}

export type WebsiteGalleryItemView =
  Awaited<ReturnType<WebsiteRepository["listGallery"]>>["data"][number] & {
    imageUrl: string | null
  }
type GalleryRepositoryItem =
  Awaited<ReturnType<WebsiteRepository["listGallery"]>>["data"][number]

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
    const tenant = await this.resolvePublicWebsiteTenant(
      values.organizationId,
      values.hostelId
    )

    return getOrSetCache(
      buildTenantCacheKey({
        organizationId: tenant.organizationId,
        hostelId: tenant.hostelId,
        scope: "cms",
        identifier: `settings:${values.sectionKey ?? "all"}:${values.status ?? "published"}`,
      }),
      {
        ttlMs: 60_000,
        tags: [`tenant:${tenant.organizationId}:cms`],
      },
      () =>
        this.websiteRepository.listSettings({
          ...values,
          organizationId: tenant.organizationId,
          hostelId: tenant.hostelId,
          status: values.status ?? "published",
        })
    )
  }

  async updateSetting(input: unknown) {
    const values = updateWebsiteSettingSchema.parse(input)
    const context = await this.authService.requirePermission("cms.manage")
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

    await invalidateCacheByTag(`tenant:${values.organizationId}:cms`)

    return setting
  }

  async listFacilities(input: unknown) {
    const values = facilitiesListSchema.parse(input)
    const tenant = await this.resolvePublicWebsiteTenant(
      values.organizationId,
      values.hostelId
    )

    return getOrSetCache(
      buildTenantCacheKey({
        organizationId: tenant.organizationId,
        hostelId: tenant.hostelId,
        scope: "cms",
        identifier: `facilities:${values.highlightedOnly ? "highlighted" : "all"}:${values.status ?? "published"}`,
      }),
      {
        ttlMs: 60_000,
        tags: [`tenant:${tenant.organizationId}:cms`],
      },
      () =>
        this.websiteRepository.listFacilities({
          ...values,
          organizationId: tenant.organizationId,
          hostelId: tenant.hostelId,
          status: values.status ?? "published",
        })
    )
  }

  async createFacility(input: unknown) {
    const values = createFacilitySchema.parse(input)
    const context = await this.authService.requirePermission("cms.manage")
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

    await invalidateCacheByTag(`tenant:${values.organizationId}:cms`)

    return facility
  }

  async updateFacility(input: unknown) {
    const values = updateFacilitySchema.parse(input)
    const context = await this.authService.requirePermission("cms.manage")
    const existingFacility = await this.websiteRepository.getFacilityById(
      values.facilityId,
      values.organizationId
    )

    if (!existingFacility) {
      throw notFound("Facility not found.")
    }

    this.authService.requireHostelAccess(
      context,
      existingFacility.organization_id,
      existingFacility.hostel_id
    )

    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId ?? existingFacility.hostel_id ?? undefined
    )
    const publishedAt =
      values.status === "published" && existingFacility.status !== "published"
        ? new Date().toISOString()
        : undefined
    const facility = await this.websiteRepository.updateFacility(
      values.facilityId,
      values.organizationId,
      {
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
        updated_by: context.authUser.id,
      }
    )

    await invalidateCacheByTag(`tenant:${values.organizationId}:cms`)

    return facility
  }

  async listGallery(input: unknown) {
    const values = galleryListSchema.parse(input)
    const tenant = await this.resolvePublicWebsiteTenant(
      values.organizationId,
      values.hostelId
    )

    const gallery = await this.websiteRepository.listGallery({
      ...values,
      organizationId: tenant.organizationId,
      hostelId: tenant.hostelId,
      status: values.status ?? "published",
    })
    const publicDocuments = await this.loadMissingPublicGalleryDocuments(gallery.data)

    return {
      ...gallery,
      data: gallery.data.map((item) => {
        const document = item.document ?? publicDocuments.get(item.document_id) ?? null

        return {
          ...item,
          document,
          imageUrl: document
            ? versionedPublicUrl(
                this.uploadsRepository.getPublicUrl(
                  document.bucket_name,
                  document.storage_path
                ),
                item.updated_at ?? item.created_at
              )
            : null,
        }
      }),
    }
  }

  async createGalleryItem(input: unknown) {
    const values = createGalleryItemSchema.parse(input)
    const context = await this.authService.requirePermission("cms.manage")
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

    await invalidateCacheByTag(`tenant:${values.organizationId}:cms`)

    return item
  }

  async uploadGalleryImage(input: unknown, file: File) {
    const values = uploadGalleryImageSchema.parse(input)
    const context = await this.authService.requirePermission("cms.manage")
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

      await invalidateCacheByTag(`tenant:${values.organizationId}:cms`)
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
          imageUrl: versionedPublicUrl(
            this.uploadsRepository.getPublicUrl(GALLERY_BUCKET, storagePath),
            gallery.updated_at ?? gallery.created_at
          ),
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

  private async loadMissingPublicGalleryDocuments(items: GalleryRepositoryItem[]) {
    const documentIds = Array.from(
      new Set(
        items
          .filter((item) => !item.document && item.status === "published")
          .map((item) => item.document_id)
      )
    )

    if (documentIds.length === 0) {
      return new Map()
    }

    try {
      const adminRepository = new WebsiteRepository(createSupabaseAdminClient())

      return adminRepository.loadGalleryDocuments(documentIds, {
        publicGalleryOnly: true,
      })
    } catch {
      return new Map()
    }
  }

  private async resolvePublicWebsiteTenant(organizationId?: string, hostelId?: string) {
    const resolvedOrganizationId =
      organizationId || process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID
    const resolvedHostelId = hostelId || process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID

    if (resolvedOrganizationId) {
      return {
        organizationId: resolvedOrganizationId,
        hostelId: resolvedHostelId || undefined,
      }
    }

    const defaultTenant = await new AdmissionsRepository(this.db).getDefaultTenant()

    if (!defaultTenant?.organizationId) {
      throw badRequest("Website tenant setup is required before public content can be loaded.")
    }

    return {
      organizationId: defaultTenant.organizationId,
      hostelId: defaultTenant.hostelId || undefined,
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
