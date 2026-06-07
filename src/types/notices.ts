import type { Tables } from "@/types/database"

export type NoticeReadStats = {
  total_recipients: number
  read_count: number
  unread_count: number
  read_percentage: number
  acknowledgement_count: number
  pending_count: number
  acknowledgement_percentage: number
}

export type NoticeWithEngagement = Tables<"notices"> &
  NoticeReadStats & {
    is_read?: boolean
    is_acknowledged?: boolean
    notification_id?: string | null
  }
