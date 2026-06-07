import type { Tables, TablesInsert } from "@/types/database"

import {
  throwRepositoryError,
  type AppSupabaseClient,
} from "./types"

export type NoticeAcknowledgementRow = Tables<"notice_acknowledgements">

export class NoticeAcknowledgementsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async upsertAcknowledgement(values: TablesInsert<"notice_acknowledgements">) {
    const { data, error } = await this.db
      .from("notice_acknowledgements")
      .upsert(values, { onConflict: "notice_id,resident_id" })
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to acknowledge notice.")
    }

    return data
  }

  async listAcknowledgedNoticeIdsForResident(input: {
    organizationId: string
    residentId: string
    noticeIds: string[]
  }) {
    if (input.noticeIds.length === 0) {
      return new Set<string>()
    }

    const { data, error } = await this.db
      .from("notice_acknowledgements")
      .select("notice_id")
      .eq("organization_id", input.organizationId)
      .eq("resident_id", input.residentId)
      .in("notice_id", input.noticeIds)

    if (error) {
      throwRepositoryError(error, "Unable to load notice acknowledgement state.")
    }

    return new Set((data ?? []).map((acknowledgement) => acknowledgement.notice_id))
  }

  async listAcknowledgementCountsByNotice(input: {
    organizationId: string
    hostelId?: string | null
    noticeIds: string[]
  }) {
    if (input.noticeIds.length === 0) {
      return new Map<string, number>()
    }

    let query = this.db
      .from("notice_acknowledgements")
      .select("notice_id")
      .eq("organization_id", input.organizationId)
      .in("notice_id", input.noticeIds)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load notice acknowledgement counts.")
    }

    const counts = new Map<string, number>()

    for (const acknowledgement of data ?? []) {
      counts.set(
        acknowledgement.notice_id,
        (counts.get(acknowledgement.notice_id) ?? 0) + 1
      )
    }

    return counts
  }
}
