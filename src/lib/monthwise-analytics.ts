export type MonthwiseQuickFilter =
  | "this-month"
  | "last-month"
  | "last-3-months"
  | "last-6-months"
  | "this-year"
  | "custom"

export type MonthwiseDateRange = {
  fromDate: string
  toDate: string
}

export type MonthOption = MonthwiseDateRange & {
  value: string
  label: string
}

export const monthwiseQuickFilterLabels: Record<MonthwiseQuickFilter, string> = {
  "this-month": "This Month",
  "last-month": "Last Month",
  "last-3-months": "Last 3 Months",
  "last-6-months": "Last 6 Months",
  "this-year": "This Year",
  custom: "Custom Range",
}

export const monthwiseQuickFilters: MonthwiseQuickFilter[] = [
  "this-month",
  "last-month",
  "last-3-months",
  "last-6-months",
  "this-year",
  "custom",
]

export function getMonthwiseQuickFilterRange(
  filter: Exclude<MonthwiseQuickFilter, "custom">,
  now = new Date()
): MonthwiseDateRange {
  const currentMonthStart = utcDate(now.getUTCFullYear(), now.getUTCMonth(), 1)

  switch (filter) {
    case "this-month":
      return {
        fromDate: dateInput(currentMonthStart),
        toDate: dateInput(now),
      }
    case "last-month": {
      const start = utcDate(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
      const end = utcDate(now.getUTCFullYear(), now.getUTCMonth(), 0)

      return {
        fromDate: dateInput(start),
        toDate: dateInput(end),
      }
    }
    case "last-3-months":
      return {
        fromDate: dateInput(utcDate(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)),
        toDate: dateInput(now),
      }
    case "last-6-months":
      return {
        fromDate: dateInput(utcDate(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)),
        toDate: dateInput(now),
      }
    case "this-year":
      return {
        fromDate: dateInput(utcDate(now.getUTCFullYear(), 0, 1)),
        toDate: dateInput(now),
      }
  }
}

export function buildMonthOptions(now = new Date(), count = 36): MonthOption[] {
  return Array.from({ length: count }, (_, index) => {
    const monthStart = utcDate(now.getUTCFullYear(), now.getUTCMonth() - index, 1)
    const monthEnd = utcDate(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth() + 1,
      0
    )
    const isCurrentMonth =
      monthStart.getUTCFullYear() === now.getUTCFullYear() &&
      monthStart.getUTCMonth() === now.getUTCMonth()

    return {
      value: monthValue(monthStart),
      label: monthStart.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      fromDate: dateInput(monthStart),
      toDate: dateInput(isCurrentMonth ? now : monthEnd),
    }
  })
}

export function monthValue(date: Date) {
  return date.toISOString().slice(0, 7)
}

export function exactMonthValue(range: MonthwiseDateRange) {
  const from = new Date(`${range.fromDate}T00:00:00.000Z`)
  const to = new Date(`${range.toDate}T00:00:00.000Z`)

  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from.getUTCDate() !== 1
  ) {
    return "range"
  }

  return from.getUTCFullYear() === to.getUTCFullYear() &&
    from.getUTCMonth() === to.getUTCMonth()
    ? monthValue(from)
    : "range"
}

export function describeMonthwiseRange(range: MonthwiseDateRange) {
  const selectedMonth = exactMonthValue(range)

  if (selectedMonth !== "range") {
    const [year, month] = selectedMonth.split("-").map(Number)

    return utcDate(year, month - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
  }

  return `${range.fromDate} to ${range.toDate}`
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day))
}
