import type {
  NotificationChannel,
  NotificationRow,
  NotificationStatus,
} from "@/repositories/notifications.repository"
import type { Json } from "@/types/database"

export type NotificationRecipient = {
  userId?: string | null
  residentId?: string | null
  email?: string | null
  phone?: string | null
}

export type NotificationMessage = {
  title: string
  body: string
  templateKey?: string | null
  payload?: Json
}

export type NotificationSendInput = {
  notification: NotificationRow
  recipient: NotificationRecipient
}

export type NotificationSendResult = {
  status: Extract<NotificationStatus, "sent" | "queued" | "failed">
  provider: string
  providerMessageId?: string | null
  responsePayload?: Json
  errorMessage?: string | null
}

export type NotificationProvider = {
  channel: NotificationChannel
  providerName: string
  send(input: NotificationSendInput): Promise<NotificationSendResult>
}
