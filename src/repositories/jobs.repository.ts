import type { TablesInsert } from "@/types/database"

import { throwRepositoryError, type AppSupabaseClient } from "./types"

export class JobsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async recordJobEvent(values: TablesInsert<"audit_logs">) {
    const { data, error } = await this.db
      .from("audit_logs")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to record job execution event.")
    }

    return data
  }
}
