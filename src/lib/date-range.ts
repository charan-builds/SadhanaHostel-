export type NormalizedDateRange = {
  fromDate?: string
  toDate?: string
}

export function normalizeDateRange(input: {
  fromDate?: string | null
  toDate?: string | null
}): NormalizedDateRange {
  return {
    fromDate: input.fromDate ? normalizeDateBoundary(input.fromDate, "start") : undefined,
    toDate: input.toDate ? normalizeDateBoundary(input.toDate, "end") : undefined,
  }
}

export function normalizeDateBoundary(value: string, boundary: "start" | "end") {
  const trimmed = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}${boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z"}`
  }

  const parsed = new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    return trimmed
  }

  if (boundary === "start") {
    parsed.setUTCHours(0, 0, 0, 0)
  } else {
    parsed.setUTCHours(23, 59, 59, 999)
  }

  return parsed.toISOString()
}
