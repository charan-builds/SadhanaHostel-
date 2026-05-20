import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { badRequest, forbidden } from "@/lib/api/api-error"
import { logAuditEvent } from "@/lib/logger"
import { incrementMetric } from "@/lib/metrics"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { UploadsRepository } from "@/repositories/uploads.repository"
import type { Database } from "@/types/database"
import {
  uploadDocumentSchema,
  uploadPaymentProofSchema,
  uploadProfilePhotoSchema,
} from "@/validations/upload.validation"

import { assertFound, AuthService } from "./auth.service"

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
])

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

type DocumentType = Database["public"]["Enums"]["document_type_enum"]

export class UploadsService {
  private readonly authService: AuthService
  private readonly residentsRepository: ResidentsRepository
  private readonly uploadsRepository: UploadsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.residentsRepository = new ResidentsRepository(db)
    this.uploadsRepository = new UploadsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new UploadsService(db)
  }

  async uploadDocument(input: unknown, file: File) {
    const values = uploadDocumentSchema.parse(input)

    return this.uploadResidentFile({
      ...values,
      file,
      bucketName: "resident-documents",
      documentType: values.documentType,
      allowedMimeTypes: DOCUMENT_MIME_TYPES,
      maxBytes: MAX_DOCUMENT_BYTES,
    })
  }

  async uploadPaymentProof(input: unknown, file: File) {
    const values = uploadPaymentProofSchema.parse(input)

    return this.uploadResidentFile({
      ...values,
      file,
      bucketName: "payment-screenshots",
      documentType: "payment_receipt",
      allowedMimeTypes: IMAGE_MIME_TYPES,
      maxBytes: MAX_IMAGE_BYTES,
      paymentId: values.paymentId,
    })
  }

  async uploadProfilePhoto(input: unknown, file: File) {
    const values = uploadProfilePhotoSchema.parse(input)

    return this.uploadResidentFile({
      ...values,
      file,
      bucketName: "resident-documents",
      documentType: "profile_image",
      allowedMimeTypes: IMAGE_MIME_TYPES,
      maxBytes: MAX_IMAGE_BYTES,
    })
  }

  private async uploadResidentFile(input: {
    organizationId: string
    hostelId?: string
    residentId: string
    paymentId?: string
    isPublic?: boolean
    file: File
    bucketName: string
    documentType: DocumentType
    allowedMimeTypes: Set<string>
    maxBytes: number
  }) {
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, input.organizationId)
    this.validateFile(input.file, input.allowedMimeTypes, input.maxBytes)

    const resident = await this.residentsRepository.getById(
      input.residentId,
      input.organizationId
    )
    const existingResident = assertFound(resident, "Resident not found.")
    const isAdmin = context.roles.some((role) => [...ADMIN_ROLES, "staff"].includes(role))

    if (!isAdmin && existingResident.user_id !== context.authUser.id) {
      throw forbidden("Residents can only upload their own files.")
    }

    const storagePath = this.buildResidentStoragePath(
      input.organizationId,
      input.residentId,
      input.file.name
    )

    await this.uploadsRepository.uploadObject(
      input.bucketName,
      storagePath,
      input.file
    )

    try {
      const document = await this.uploadsRepository.createDocument({
        organization_id: input.organizationId,
        hostel_id: input.hostelId ?? existingResident.hostel_id,
        resident_id: input.residentId,
        payment_id: input.paymentId,
        uploaded_by_user_id: context.authUser.id,
        document_type: input.documentType,
        bucket_name: input.bucketName,
        storage_path: storagePath,
        file_name: input.file.name,
        mime_type: input.file.type,
        file_size_bytes: input.file.size,
        is_public: input.isPublic ?? false,
        created_by: context.authUser.id,
        updated_by: context.authUser.id,
      })

      const signedUrl = await this.uploadsRepository.createSignedUrl(
        input.bucketName,
        storagePath
      )

      logAuditEvent({
        action: "upload.created",
        actorUserId: context.authUser.id,
        organizationId: input.organizationId,
        targetTable: "documents",
        targetId: document.id,
        outcome: "success",
        details: {
          bucketName: input.bucketName,
          documentType: input.documentType,
          residentId: input.residentId,
          paymentId: input.paymentId,
        },
      })
      incrementMetric("uploads.created", 1, {
        organizationId: input.organizationId,
        bucketName: input.bucketName,
        documentType: input.documentType,
      })

      return {
        document,
        signedUrl,
      }
    } catch (error) {
      await this.uploadsRepository.removeObject(input.bucketName, storagePath)
      throw error
    }
  }

  private validateFile(file: File, allowedMimeTypes: Set<string>, maxBytes: number) {
    if (!file || file.size === 0) {
      throw badRequest("A non-empty file is required.")
    }

    if (file.size > maxBytes) {
      throw badRequest("File is larger than the allowed upload size.")
    }

    if (!allowedMimeTypes.has(file.type)) {
      throw badRequest("File type is not allowed for this upload.")
    }
  }

  private buildResidentStoragePath(
    organizationId: string,
    residentId: string,
    fileName: string
  ) {
    const safeFileName = fileName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")

    return `${organizationId}/${residentId}/${crypto.randomUUID()}-${safeFileName}`
  }
}
