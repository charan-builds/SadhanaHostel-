import type { Tables } from "@/types/database"

type NoticeAudience = Pick<Tables<"notices">, "audience_filter" | "audience_type" | "hostel_id">
type NoticeRecipient = Pick<Tables<"residents">, "hostel_id" | "id"> & {
  current_room_id?: string | null
  roles?: readonly string[] | null
}

export function noticeTargetsResident(
  notice: NoticeAudience,
  resident: NoticeRecipient
) {
  if (notice.hostel_id && resident.hostel_id !== notice.hostel_id) {
    return false
  }

  if (notice.audience_type === "all" || notice.audience_type === "hostel") {
    return true
  }

  if (notice.audience_type === "residents") {
    return getNoticeAudienceIds(notice, "resident_ids").has(resident.id)
  }

  if (notice.audience_type === "room") {
    return Boolean(
      resident.current_room_id &&
        getNoticeAudienceIds(notice, "room_ids").has(resident.current_room_id)
    )
  }

  if (notice.audience_type === "roles") {
    const residentRoles = new Set(
      (resident.roles ?? []).filter((role): role is string => typeof role === "string")
    )

    if (residentRoles.size === 0) {
      return false
    }

    return Array.from(getNoticeAudienceRoles(notice)).some((role) =>
      residentRoles.has(role)
    )
  }

  return false
}

export function getNoticeAudienceIds(
  notice: Pick<Tables<"notices">, "audience_filter">,
  key: "resident_ids" | "room_ids"
) {
  const filter = notice.audience_filter

  if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
    return new Set<string>()
  }

  const values = filter[key]

  if (!Array.isArray(values)) {
    return new Set<string>()
  }

  return new Set(values.filter((value): value is string => typeof value === "string"))
}

export function getNoticeAudienceRoles(
  notice: Pick<Tables<"notices">, "audience_filter">
) {
  const filter = notice.audience_filter

  if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
    return new Set<string>()
  }

  const values = filter.roles

  if (!Array.isArray(values)) {
    return new Set<string>()
  }

  return new Set(values.filter((value): value is string => typeof value === "string"))
}
