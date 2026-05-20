import type { Tables, TablesInsert } from "@/types/database"

import { RepositoryError, throwRepositoryError, type AppSupabaseClient } from "./types"

export type DocumentRow = Tables<"documents">

export class UploadsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async uploadObject(bucketName: string, storagePath: string, file: File) {
    const { data, error } = await this.db.storage
      .from(bucketName)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
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

    return data
  }

  async removeObject(bucketName: string, storagePath: string) {
    const { error } = await this.db.storage.from(bucketName).remove([storagePath])

    if (error) {
      throw new RepositoryError(error.message, "STORAGE_DELETE_FAILED", error)
    }
  }
}
