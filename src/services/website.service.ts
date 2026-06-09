import "server-only"

import { badRequest, notFound } from "@/lib/api/api-error"
import {
  buildTenantCacheKey,
  getOrSetCache,
  invalidateCacheByTag,
} from "@/lib/cache"
import { logAuditEvent } from "@/lib/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { inspectUploadFile } from "@/lib/uploads/file-security"
import { AdmissionsRepository } from "@/repositories/admissions.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { UploadsRepository } from "@/repositories/uploads.repository"
import { WebsiteRepository } from "@/repositories/website.repository"
import type { Json, Tables } from "@/types/database"
import {
  createFacilitySchema,
  createEmployeeAccommodationRoomSchema,
  createGalleryItemSchema,
  employeeAccommodationRoomsListSchema,
  facilitiesListSchema,
  galleryListSchema,
  updateFacilitySchema,
  updateEmployeeAccommodationRoomSchema,
  updateWebsiteSettingSchema,
  deleteGalleryItemSchema,
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
export type EmployeeAccommodationRoomView =
  Awaited<ReturnType<WebsiteRepository["listEmployeeAccommodationRooms"]>>["data"][number] & {
    imageCategory: string
    images: WebsiteGalleryItemView[]
  }
type GalleryRepositoryItem =
  Awaited<ReturnType<WebsiteRepository["listGallery"]>>["data"][number]
type GalleryDocument = Pick<Tables<"documents">, "id" | "bucket_name" | "storage_path">

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

  static createPublic() {
    return new WebsiteService(createSupabasePublicServerClient())
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

  async listEmployeeAccommodationRooms(input: unknown) {
    const values = employeeAccommodationRoomsListSchema.parse(input)
    const tenant = await this.resolvePublicWebsiteTenant(
      values.organizationId,
      values.hostelId
    )
    const rooms = await this.websiteRepository.listEmployeeAccommodationRooms({
      ...values,
      organizationId: tenant.organizationId,
      hostelId: tenant.hostelId,
      status: values.status ?? (values.includeHidden ? undefined : "published"),
      includeHidden: values.includeHidden ?? false,
    })
    const roomCategories = rooms.data.map((room) => employeeRoomGalleryCategory(room.id))
    const galleryRows = await this.listGalleryItemsByCategories({
      organizationId: tenant.organizationId,
      hostelId: tenant.hostelId,
      categories: roomCategories,
      status: values.includeHidden ? undefined : "published",
    })
    const publicDocuments = await this.loadMissingPublicGalleryDocuments(galleryRows)
    const galleryItems = galleryRows.map((item) =>
      this.mapGalleryItemView(item, publicDocuments)
    )
    const imagesByCategory = new Map<string, WebsiteGalleryItemView[]>()

    for (const item of galleryItems) {
      const images = imagesByCategory.get(item.category) ?? []

      images.push(item)
      imagesByCategory.set(item.category, images)
    }

    return {
      ...rooms,
      data: rooms.data.map((room) => {
        const imageCategory = employeeRoomGalleryCategory(room.id)

        return {
          ...room,
          imageCategory,
          images: imagesByCategory.get(imageCategory) ?? [],
        }
      }),
    }
  }

  async createEmployeeAccommodationRoom(input: unknown) {
    const values = createEmployeeAccommodationRoomSchema.parse(input)
    const context = await this.authService.requirePermission("cms.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )
    const publishedAt =
      values.status === "published" && values.isVisible ? new Date().toISOString() : null
    const room = await this.websiteRepository.createEmployeeAccommodationRoom({
      organization_id: values.organizationId,
      hostel_id: hostelId,
      title: values.title,
      description: values.description,
      capacity: values.capacity,
      amenities: values.amenities,
      sort_order: values.sortOrder,
      is_visible: values.isVisible,
      status: values.status,
      published_at: publishedAt,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    await invalidateCacheByTag(`tenant:${values.organizationId}:cms`)

    return {
      ...room,
      imageCategory: employeeRoomGalleryCategory(room.id),
      images: [],
    }
  }

  async updateEmployeeAccommodationRoom(input: unknown) {
    const values = updateEmployeeAccommodationRoomSchema.parse(input)
    const context = await this.authService.requirePermission("cms.manage")
    const existingRoom = await this.websiteRepository.getEmployeeAccommodationRoomById(
      values.roomId,
      values.organizationId
    )

    if (!existingRoom) {
      throw notFound("Employee accommodation room not found.")
    }

    this.authService.requireHostelAccess(
      context,
      existingRoom.organization_id,
      existingRoom.hostel_id
    )

    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId ?? existingRoom.hostel_id ?? undefined
    )
    const publishedAt =
      values.status === "published" && values.isVisible && existingRoom.status !== "published"
        ? new Date().toISOString()
        : undefined
    const room = await this.websiteRepository.updateEmployeeAccommodationRoom(
      values.roomId,
      values.organizationId,
      {
        hostel_id: hostelId,
        title: values.title,
        description: values.description,
        capacity: values.capacity,
        amenities: values.amenities,
        sort_order: values.sortOrder,
        is_visible: values.isVisible,
        status: values.status,
        published_at: publishedAt,
        updated_by: context.authUser.id,
      }
    )

    await invalidateCacheByTag(`tenant:${values.organizationId}:cms`)

    return {
      ...room,
      imageCategory: employeeRoomGalleryCategory(room.id),
      images: [],
    }
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
      data: gallery.data.map((item) => this.mapGalleryItemView(item, publicDocuments)),
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

    const fileInspection = await this.validateGalleryFile(file)

    const storagePath = this.buildGalleryStoragePath(
      values.organizationId,
      hostelId ?? undefined,
      fileInspection.safeFileName
    )

    await this.uploadsRepository.uploadObject(GALLERY_BUCKET, storagePath, file, {
      cacheControl: "31536000",
      upsert: false,
    })

    try {
      const document = await this.uploadsRepository.createDocument({
        organization_id: values.organizationId,
        hostel_id: hostelId,
        uploaded_by_user_id: context.authUser.id,
        document_type: "gallery_image",
        bucket_name: GALLERY_BUCKET,
        storage_path: storagePath,
        file_name: fileInspection.safeFileName,
        mime_type: fileInspection.mimeType,
        file_size_bytes: fileInspection.size,
        checksum: fileInspection.checksum,
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

  async deleteGalleryItem(input: unknown) {
    const values = deleteGalleryItemSchema.parse(input)
    const context = await this.authService.requirePermission("cms.manage")
    const existingItem = await this.websiteRepository.getGalleryItemById(
      values.galleryItemId,
      values.organizationId
    )

    if (!existingItem) {
      throw notFound("Gallery image not found.")
    }

    this.authService.requireHostelAccess(
      context,
      existingItem.organization_id,
      existingItem.hostel_id
    )

    const deletedAt = new Date().toISOString()
    const item = await this.websiteRepository.updateGalleryItem(
      values.galleryItemId,
      values.organizationId,
      {
        status: "archived",
        is_active: false,
        deleted_at: deletedAt,
        deleted_by: context.authUser.id,
        updated_by: context.authUser.id,
      }
    )

    await invalidateCacheByTag(`tenant:${values.organizationId}:cms`)
    logAuditEvent({
      action: "cms.gallery.deleted",
      actorUserId: context.authUser.id,
      organizationId: values.organizationId,
      targetTable: "gallery",
      targetId: item.id,
      outcome: "success",
      details: {
        hostelId: existingItem.hostel_id,
        documentId: existingItem.document_id,
        deletedAt,
      },
    })

    return item
  }

  private validateGalleryFile(file: File) {
    return inspectUploadFile(file, {
      allowedMimeTypes: GALLERY_IMAGE_MIME_TYPES,
      maxBytes: MAX_GALLERY_IMAGE_BYTES,
      label: "gallery image",
      fallbackBaseName: "image",
    })
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

  private async listGalleryItemsByCategories({
    organizationId,
    hostelId,
    categories,
    status,
  }: {
    organizationId: string
    hostelId?: string
    categories: string[]
    status?: "draft" | "published" | "archived"
  }) {
    if (categories.length === 0) {
      return []
    }

    const pageSize = 100
    const items: GalleryRepositoryItem[] = []
    let page = 1
    let total = 0

    do {
      const gallery = await this.websiteRepository.listGallery({
        organizationId,
        hostelId,
        categories,
        page,
        pageSize,
        status,
      })

      items.push(...gallery.data)
      total = gallery.meta.total
      page += 1
    } while (items.length < total)

    return items
  }

  private mapGalleryItemView(
    item: GalleryRepositoryItem,
    publicDocuments = new Map<string, GalleryDocument>()
  ): WebsiteGalleryItemView {
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
    safeFileName: string
  ) {
    return `${organizationId}/${hostelId ?? "global"}/gallery/${crypto.randomUUID()}-${safeFileName}`
  }
}

export function employeeRoomGalleryCategory(roomId: string) {
  return `employee-room:${roomId}`
}
