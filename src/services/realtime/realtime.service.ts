import "server-only"

import type { AppSupabaseClient } from "@/repositories/types"
import type { Json } from "@/types/database"

import { RealtimeEventPublisher } from "./event-publisher"

export class RealtimeService {
  private readonly publisher: RealtimeEventPublisher

  constructor(db?: AppSupabaseClient) {
    this.publisher = new RealtimeEventPublisher(db)
  }

  notificationCreated(input: {
    organizationId: string
    hostelId?: string | null
    notificationId: string
    recipientUserId?: string | null
    residentId?: string | null
  }) {
    return this.publisher.publish({
      type: "notification.created",
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      payload: input satisfies Json,
    })
  }

  paymentStatusChanged(input: {
    organizationId: string
    hostelId?: string | null
    actorUserId?: string | null
    paymentId: string
    residentId: string
    status: string
  }) {
    return this.publisher.publish({
      type: "payment.status_changed",
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      actorUserId: input.actorUserId,
      payload: input satisfies Json,
    })
  }

  leaveStatusChanged(input: {
    organizationId: string
    hostelId?: string | null
    actorUserId?: string | null
    leaveRequestId: string
    residentId: string
    status: string
  }) {
    return this.publisher.publish({
      type: "leave.status_changed",
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      actorUserId: input.actorUserId,
      payload: input satisfies Json,
    })
  }

  dashboardRefresh(input: {
    organizationId: string
    hostelId?: string | null
    reason: string
  }) {
    return this.publisher.publish({
      type: "dashboard.refresh",
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      payload: input satisfies Json,
    })
  }
}
