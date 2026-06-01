import { z } from "zod"

import { Constants } from "@/types/database"

import {
  booleanLikeSchema,
  jsonObjectSchema,
  paginationSchema,
  uuidSchema,
} from "./common.validation"

export const websiteSettingsListSchema = paginationSchema.extend({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
  sectionKey: z.string().trim().max(80).optional(),
  status: z.enum(Constants.public.Enums.cms_status_enum).optional(),
})

export const updateWebsiteSettingSchema = z.object({
  settingId: uuidSchema,
  organizationId: uuidSchema,
  title: z.string().trim().max(160).optional(),
  content: jsonObjectSchema.optional(),
  status: z.enum(Constants.public.Enums.cms_status_enum).optional(),
  seoTitle: z.string().trim().max(180).optional(),
  seoDescription: z.string().trim().max(300).optional(),
})

export const facilitiesListSchema = paginationSchema.extend({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
  status: z.enum(Constants.public.Enums.cms_status_enum).optional(),
  highlightedOnly: booleanLikeSchema.optional(),
})

export const createFacilitySchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(1000).optional(),
  iconName: z.string().trim().max(80).optional(),
  imageDocumentId: uuidSchema.optional(),
  isHighlighted: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(Constants.public.Enums.cms_status_enum).default("draft"),
})

export const galleryListSchema = paginationSchema.extend({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
  status: z.enum(Constants.public.Enums.cms_status_enum).optional(),
  category: z.string().trim().max(80).optional(),
})

export const createGalleryItemSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  documentId: uuidSchema,
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  altText: z.string().trim().max(240).optional(),
  category: z.string().trim().max(80).default("general"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(Constants.public.Enums.cms_status_enum).default("draft"),
})

export const uploadGalleryImageSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  altText: z.string().trim().max(240).optional(),
  category: z.string().trim().max(80).default("general"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(Constants.public.Enums.cms_status_enum).default("published"),
})

export type WebsiteSettingsListInput = z.infer<typeof websiteSettingsListSchema>
export type UpdateWebsiteSettingInput = z.infer<typeof updateWebsiteSettingSchema>
export type FacilitiesListInput = z.infer<typeof facilitiesListSchema>
export type CreateFacilityInput = z.infer<typeof createFacilitySchema>
export type GalleryListInput = z.infer<typeof galleryListSchema>
export type CreateGalleryItemInput = z.infer<typeof createGalleryItemSchema>
export type UploadGalleryImageInput = z.infer<typeof uploadGalleryImageSchema>
