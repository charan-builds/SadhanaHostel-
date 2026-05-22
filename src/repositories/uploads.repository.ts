import type { Tables, TablesInsert, TablesUpdate } from "@/types/database"

import { RepositoryError, throwRepositoryError, type AppSupabaseClient } from "./types"

export type DocumentRow = Tables<"documents">

export class UploadsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async uploadObject(
    bucketName: string,
    storagePath: string,
    file: File,
    options?: { upsert?: boolean; cacheControl?: string }
  ) {
    const { data, error } = await this.db.storage
      .from(bucketName)
      .upload(storagePath, file, {
        cacheControl: options?.cacheControl ?? "3600",
        contentType: file.type,
        upsert: options?.upsert ?? false,
      })

    if (error) {
      throw new RepositoryError(error.message, "STORAGE_UPLOAD_FAILED", error)
    }

    return data
  }

  async createDocument(values: TablesInsert<"documents">) {
    const { data, error } = await this.db
      .from("documents")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create document metadata.")
    }

    return data
  }

  async createSignedUrl(bucketName: string, storagePath: string, expiresIn = 3600) {
    const { data, error } = await this.db.storage
      .from(bucketName)
      .createSignedUrl(storagePath, expiresIn)

    if (error) {
      throw new RepositoryError(error.message, "SIGNED_URL_FAILED", error)
    }

    return data.signedUrl
  }

  getPublicUrl(bucketName: string, storagePath: string) {
    const { data } = this.db.storage.from(bucketName).getPublicUrl(storagePath)

    return data.publicUrl
  }

  async findLatestPaymentProof(organizationId: string, paymentId: string) {
    const { data, error } = await this.db
      .from("documents")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("payment_id", paymentId)
      .eq("document_type", "payment_receipt")
      .neq("status", "rejected")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load payment proof.")
    }

    return data
  }

  async removeObject(bucketName: string, storagePath: string) {
    const { error } = await this.db.storage.from(bucketName).remove([storagePath])

    if (error) {
      throw new RepositoryError(error.message, "STORAGE_DELETE_FAILED", error)
    }
  }

  async listStalePendingDocuments(organizationId: string, olderThanIso: string, limit = 100) {
    const { data, error } = await this.db
      .from("documents")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .lte("created_at", olderThanIso)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(limit)

    if (error) {
      throwRepositoryError(error, "Unable to load stale documents.")
    }

    return data ?? []
  }

  async updateDocument(
    documentId: string,
    organizationId: string,
    values: TablesUpdate<"documents">
  ) {
    const { data, error } = await this.db
      .from("documents")
      .update(values)
      .eq("id", documentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update document metadata.")
    }

    return data
  }
}
