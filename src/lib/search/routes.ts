import type { Route } from "next"

import type { SearchResult } from "@/sdk/types"

export function getSearchResultHref(result: Pick<SearchResult, "entity_type" | "entity_id">): Route {
  switch (result.entity_type) {
    case "residents":
      return `/admin/residents/${result.entity_id}` as Route
    case "payments":
      return "/admin/payments" as Route
    case "rooms":
      return "/admin/rooms" as Route
    case "notices":
      return "/admin/notices" as Route
    case "complaints":
      return "/admin/alerts" as Route
    case "reports":
      return "/admin/reports" as Route
  }
}

export function getSearchResultLabel(entityType: SearchResult["entity_type"]) {
  switch (entityType) {
    case "residents":
      return "Resident"
    case "payments":
      return "Payment"
    case "rooms":
      return "Room"
    case "notices":
      return "Notice"
    case "complaints":
      return "Complaint"
    case "reports":
      return "Report"
  }
}
