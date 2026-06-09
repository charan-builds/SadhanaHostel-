import { badRequest } from "@/lib/api/api-error"

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

type UploadFileInspectionOptions = {
  allowedMimeTypes: ReadonlySet<string>
  maxBytes: number
  label: string
  fallbackBaseName?: string
}

export type UploadFileInspection = {
  safeFileName: string
  extension: string
  mimeType: string
  size: number
  checksum: string
}

export async function inspectUploadFile(
  file: File,
  options: UploadFileInspectionOptions
): Promise<UploadFileInspection> {
  if (!file || file.size === 0) {
    throw badRequest(`A non-empty ${options.label} is required.`)
  }

  if (file.size > options.maxBytes) {
    throw badRequest(`${options.label} is larger than the allowed upload size.`)
  }

  const mimeType = file.type.trim().toLowerCase()

  if (!options.allowedMimeTypes.has(mimeType)) {
    throw badRequest(`${options.label} type is not allowed for this upload.`)
  }

  const extension = MIME_EXTENSIONS[mimeType]

  if (!extension) {
    throw badRequest(`${options.label} type is not allowed for this upload.`)
  }

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (!matchesDeclaredMimeType(bytes, mimeType)) {
    throw badRequest(`${options.label} content does not match the declared file type.`)
  }

  return {
    safeFileName: sanitizeUploadFileName(
      file.name,
      extension,
      options.fallbackBaseName ?? "upload"
    ),
    extension,
    mimeType,
    size: file.size,
    checksum: await sha256(buffer),
  }
}

export function sanitizeUploadFileName(
  fileName: string,
  extension: string,
  fallbackBaseName = "upload"
) {
  const leafName = fileName.split(/[\\/]/).pop()?.split("?").at(0) ?? ""
  const lastDotIndex = leafName.lastIndexOf(".")
  const rawBaseName =
    lastDotIndex > 0 ? leafName.slice(0, lastDotIndex) : leafName
  const safeBaseName = rawBaseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)

  return `${safeBaseName || fallbackBaseName}.${extension}`
}

function matchesDeclaredMimeType(bytes: Uint8Array, mimeType: string) {
  switch (mimeType) {
    case "application/pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    case "image/png":
      return startsWith(bytes, [
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ])
    case "image/webp":
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      )
    default:
      return false
  }
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) {
    return false
  }

  return signature.every((byte, index) => bytes[index] === byte)
}

async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
