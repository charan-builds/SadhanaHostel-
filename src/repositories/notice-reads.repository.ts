import type { Tables, TablesInsert } from "@/types/database"

import {
  throwRepositoryError,
  type AppSupabaseClient,
} from "./types"

export type NoticeReadRow = Tables<"notice_reads">

export class NoticeReadsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async upsertRead(values: TablesInsert<"notice_reads">) {
    const { data, error } = await this.db
      .from("notice_reads")
      .upsert(values, { onConflict: "notice_id,resident_id" })
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to mark notice read.")
    }

    return data
  }

  async listReadNoticeIdsForResident(input: {
    organizationId: string
    residentId: string
    noticeIds: string[]
  }) {
    if (input.noticeIds.length === 0) {
      return new Set<string>()
    }

    const { data, error } = await this.db
      .from("notice_reads")
      .select("notice_id")
      .eq("organization_id", input.organizationId)
      .eq("resident_id", input.residentId)
      .in("notice_id", input.noticeIds)

    if (error) {
      throwRepositoryError(error, "Unable to load notice read state.")
    }

    return new Set((data ?? []).map((read) => read.notice_id))
  }

  async listReadCountsByNotice(input: {
    organizationId: string
    hostelId?: string | null
    noticeIds: string[]
  }) {
    if (input.noticeIds.length === 0) {
      return new Map<string, number>()
    }

    let query = this.db
      .from("notice_reads")
      .select("notice_id")
      .eq("organization_id", input.organizationId)
      .in("notice_id", input.noticeIds)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load notice read counts.")
    }

    const counts = new Map<string, number>()

    for (const read of data ?? []) {
      counts.set(read.notice_id, (counts.get(read.notice_id) ?? 0) + 1)
    }

    return counts
  }
}
