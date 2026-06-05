import "server-only"

const brandLogoRevalidateSeconds = 60

type GalleryLogoRow = {
  title: string | null
  category: string | null
  document_id: string | null
  updated_at: string | null
  created_at: string | null
}

type PublicDocumentRow = {
  bucket_name: string
  storage_path: string
}

type OrganizationBrandingRow = {
  settings: unknown
}

type PublicBrandLogoConfig = {
  supabaseUrl: string
  apiKey: string
  organizationId: string
  hostelId?: string
}

export async function getPublishedBrandLogoUrl() {
  const config = getPublicBrandLogoConfig()

  if (!config) {
    return null
  }

  const settingsLogoUrl = await getOrganizationBrandingImageUrl(config, ["logoUrl"])

  if (settingsLogoUrl) {
    return settingsLogoUrl
  }

  return getPublishedGalleryBrandLogoUrl(config)
}

export async function getPublishedBrandIconUrl() {
  const config = getPublicBrandLogoConfig()

  if (!config) {
    return null
  }

  const settingsIconUrl = await getOrganizationBrandingImageUrl(config, [
    "faviconUrl",
    "logoUrl",
  ])

  if (settingsIconUrl) {
    return settingsIconUrl
  }

  return getPublishedGalleryBrandLogoUrl(config)
}

async function getPublishedGalleryBrandLogoUrl(config: PublicBrandLogoConfig) {
  const galleryItems = await fetchSupabaseRest<GalleryLogoRow[]>(
    buildGalleryLogoRequestUrl(config),
    config.apiKey
  )
  const logoItem = galleryItems?.find(isLogoGalleryItem)

  if (!logoItem?.document_id) {
    return null
  }

  const documents = await fetchSupabaseRest<PublicDocumentRow[]>(
    buildPublicDocumentRequestUrl(config, logoItem.document_id),
    config.apiKey
  )
  const document = documents?.[0]

  if (!document) {
    return null
  }

  return buildPublicStorageUrl(
    config.supabaseUrl,
    document.bucket_name,
    document.storage_path,
    logoItem.updated_at ?? logoItem.created_at
  )
}

async function getOrganizationBrandingImageUrl(
  config: PublicBrandLogoConfig,
  keys: Array<"logoUrl" | "faviconUrl">
) {
  const organizations = await fetchSupabaseRest<OrganizationBrandingRow[]>(
    buildOrganizationBrandingRequestUrl(config),
    config.apiKey
  )
  const settings = recordFromJson(organizations?.[0]?.settings)
  const branding = recordFromJson(settings.branding)

  for (const key of keys) {
    const imageUrl = publicHttpUrlFromRecord(branding, key)

    if (imageUrl) {
      return imageUrl
    }
  }

  return null
}

function getPublicBrandLogoConfig(): PublicBrandLogoConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "")
  const apiKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim()
  const organizationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID?.trim()
  const hostelId = process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID?.trim()

  if (!supabaseUrl || !apiKey || !organizationId) {
    return null
  }

  return {
    supabaseUrl,
    apiKey,
    organizationId,
    hostelId: hostelId || undefined,
  }
}

function buildGalleryLogoRequestUrl(config: PublicBrandLogoConfig) {
  const params = new URLSearchParams({
    select: "title,category,document_id,updated_at,created_at",
    organization_id: `eq.${config.organizationId}`,
    status: "eq.published",
    deleted_at: "is.null",
    order: "sort_order.asc,created_at.desc",
    limit: "50",
  })

  if (config.hostelId) {
    params.set("or", `(hostel_id.is.null,hostel_id.eq.${config.hostelId})`)
  }

  return `${config.supabaseUrl}/rest/v1/gallery?${params.toString()}`
}

function buildOrganizationBrandingRequestUrl(config: PublicBrandLogoConfig) {
  const params = new URLSearchParams({
    select: "settings",
    id: `eq.${config.organizationId}`,
    is_active: "eq.true",
    deleted_at: "is.null",
    limit: "1",
  })

  return `${config.supabaseUrl}/rest/v1/organizations?${params.toString()}`
}

function buildPublicDocumentRequestUrl(
  config: PublicBrandLogoConfig,
  documentId: string
) {
  const params = new URLSearchParams({
    select: "bucket_name,storage_path",
    id: `eq.${documentId}`,
    bucket_name: "eq.gallery-images",
    document_type: "eq.gallery_image",
    is_public: "eq.true",
    is_active: "eq.true",
    deleted_at: "is.null",
    limit: "1",
  })

  return `${config.supabaseUrl}/rest/v1/documents?${params.toString()}`
}

async function fetchSupabaseRest<T>(url: string, apiKey: string) {
  try {
    const response = await fetch(url, {
      headers: {
        apikey: apiKey,
        authorization: `Bearer ${apiKey}`,
      },
      next: {
        revalidate: brandLogoRevalidateSeconds,
      },
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as T
  } catch {
    return null
  }
}

function isLogoGalleryItem(item: GalleryLogoRow) {
  const category = normalizeBrandKey(item.category)
  const title = normalizeBrandKey(item.title)

  return category === "logo" || category === "brand" || title === "logo" || title === "brand"
}

function normalizeBrandKey(value: string | null) {
  return value
    ?.toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function buildPublicStorageUrl(
  supabaseUrl: string,
  bucketName: string,
  storagePath: string,
  version?: string | null
) {
  const encodedBucket = encodeURIComponent(bucketName)
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/")
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${encodedBucket}/${encodedPath}`

  if (!version) {
    return publicUrl
  }

  return `${publicUrl}?v=${encodeURIComponent(version)}`
}

function recordFromJson(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function publicHttpUrlFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key]

  if (typeof value !== "string") {
    return null
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  try {
    const url = new URL(trimmedValue)

    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}
