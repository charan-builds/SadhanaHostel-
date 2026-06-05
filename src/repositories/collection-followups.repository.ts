import { throwRepositoryError, type AppSupabaseClient } from "./types"

export type CollectionFollowupStatus = "open" | "completed" | "cancelled"
export type CollectionFollowupPriority = "low" | "medium" | "high" | "critical"

export type CollectionFollowupRow = {
  id: string
  organization_id: string
  hostel_id: string | null
  resident_id: string
  created_by: string | null
  note: string
  priority: CollectionFollowupPriority
  assigned_to: string | null
  next_followup_at: string | null
  status: CollectionFollowupStatus
  completed_at: string | null
  completed_by: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
  updated_by: string | null
}

type CollectionFollowupInsert = {
  organization_id: string
  hostel_id?: string | null
  resident_id: string
  created_by: string
  note: string
  priority?: CollectionFollowupPriority
  assigned_to?: string | null
  next_followup_at?: string | null
  status?: CollectionFollowupStatus
  metadata?: Record<string, unknown>
  updated_by?: string
}

type CollectionFollowupsDb = {
  from(table: "collection_followups"): {
    select(columns?: string): CollectionFollowupQuery
    insert(values: CollectionFollowupInsert): CollectionFollowupMutateQuery
    update(values: Partial<CollectionFollowupRow>): CollectionFollowupUpdateQuery
  }
}

type CollectionFollowupQuery = {
  eq(column: string, value: string): CollectionFollowupQuery
  is(column: string, value: null): CollectionFollowupQuery
  order(column: string, options?: { ascending?: boolean }): CollectionFollowupQuery
  limit(count: number): Promise<QueryResult<CollectionFollowupRow[]>>
  maybeSingle(): Promise<QueryResult<CollectionFollowupRow | null>>
  then<TResult1 = QueryResult<CollectionFollowupRow[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<CollectionFollowupRow[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>
}

type CollectionFollowupMutateQuery = {
  select(columns?: string): {
    single(): Promise<QueryResult<CollectionFollowupRow>>
  }
}

type CollectionFollowupUpdateQuery = {
  eq(column: string, value: string): CollectionFollowupUpdateQuery
  is(column: string, value: null): CollectionFollowupUpdateQuery
  select(columns?: string): {
    single(): Promise<QueryResult<CollectionFollowupRow>>
  }
}

type QueryResult<T> = {
  data: T | null
  error: { message: string; code?: string } | null
}

export class CollectionFollowupsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async list(input: {
    organizationId: string
    hostelId?: string | null
    residentId?: string
    status?: CollectionFollowupStatus
    priority?: CollectionFollowupPriority
    assignedTo?: string | null
    limit?: number
  }) {
    let query = this.followups()
      .select("*")
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    if (input.residentId) {
      query = query.eq("resident_id", input.residentId)
    }

    if (input.status) {
      query = query.eq("status", input.status)
    }

    if (input.priority) {
      query = query.eq("priority", input.priority)
    }

    if (input.assignedTo) {
      query = query.eq("assigned_to", input.assignedTo)
    }

    const { data, error } = await query.limit(input.limit ?? 25)

    if (error) {
      throwRepositoryError(error as never, "Unable to load collection follow-ups.")
    }

    return data ?? []
  }

  async create(values: CollectionFollowupInsert) {
    const { data, error } = await this.followups().insert(values).select("*").single()

    if (error) {
      throwRepositoryError(error as never, "Unable to create collection follow-up.")
    }

    if (!data) {
      throw new Error("Collection follow-up was not returned after create.")
    }

    return data
  }

  async complete(input: {
    id: string
    organizationId: string
    actorUserId: string
    note?: string
  }) {
    const { data, error } = await this.followups()
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: input.actorUserId,
        ...(input.note ? { note: input.note } : {}),
        updated_by: input.actorUserId,
      })
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error as never, "Unable to complete collection follow-up.")
    }

    if (!data) {
      throw new Error("Collection follow-up was not returned after update.")
    }

    return data
  }

  private followups() {
    return (this.db as unknown as CollectionFollowupsDb).from("collection_followups")
  }
}
