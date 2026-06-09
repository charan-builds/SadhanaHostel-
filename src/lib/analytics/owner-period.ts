export type OwnerPeriodPreset =
  | "today"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "last_6_months"
  | "this_year"
  | "custom"

export type OwnerPeriodRange = {
  fromDate: string
  toDate: string
}

export const OWNER_PERIOD_PRESETS: Array<{
  value: OwnerPeriodPreset
  label: string
}> = [
  { value: "today", label: "Today" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
]

export function getOwnerPeriodRange(
  preset: Exclude<OwnerPeriodPreset, "custom">,
  now = new Date()
): OwnerPeriodRange {
  const today = utcDate(now)
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()

  if (preset === "today") {
    return { fromDate: today, toDate: today }
  }

  if (preset === "this_month") {
    return {
      fromDate: dateInput(new Date(Date.UTC(year, month, 1))),
      toDate: today,
    }
  }

  if (preset === "last_month") {
    return {
      fromDate: dateInput(new Date(Date.UTC(year, month - 1, 1))),
      toDate: dateInput(new Date(Date.UTC(year, month, 0))),
    }
  }

  if (preset === "last_3_months" || preset === "last_6_months") {
    const monthCount = preset === "last_3_months" ? 3 : 6

    return {
      fromDate: dateInput(new Date(Date.UTC(year, month - monthCount + 1, 1))),
      toDate: today,
    }
  }

  return {
    fromDate: `${year}-01-01`,
    toDate: today,
  }
}

export function getPreviousOwnerPeriod(
  range: OwnerPeriodRange,
  preset: OwnerPeriodPreset
): OwnerPeriodRange {
  const from = parseDateInput(range.fromDate)
  const to = parseDateInput(range.toDate)

  if (preset === "today") {
    const previousDay = addUtcDays(from, -1)

    return {
      fromDate: dateInput(previousDay),
      toDate: dateInput(previousDay),
    }
  }

  if (preset === "this_month") {
    const previousStart = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1)
    )
    const elapsedDay = to.getUTCDate()
    const previousMonthEnd = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 0)
    )
    const previousEnd = new Date(
      Date.UTC(
        previousStart.getUTCFullYear(),
        previousStart.getUTCMonth(),
        Math.min(elapsedDay, previousMonthEnd.getUTCDate())
      )
    )

    return {
      fromDate: dateInput(previousStart),
      toDate: dateInput(previousEnd),
    }
  }

  if (preset === "last_month") {
    return {
      fromDate: dateInput(
        new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1))
      ),
      toDate: dateInput(
        new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 0))
      ),
    }
  }

  if (preset === "this_year") {
    return {
      fromDate: `${from.getUTCFullYear() - 1}-01-01`,
      toDate: dateInput(
        new Date(
          Date.UTC(
            to.getUTCFullYear() - 1,
            to.getUTCMonth(),
            to.getUTCDate()
          )
        )
      ),
    }
  }

  const durationDays =
    Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1
  const previousEnd = addUtcDays(from, -1)
  const previousStart = addUtcDays(previousEnd, -(durationDays - 1))

  return {
    fromDate: dateInput(previousStart),
    toDate: dateInput(previousEnd),
  }
}

export function formatOwnerPeriodLabel(
  range: OwnerPeriodRange,
  preset: OwnerPeriodPreset
) {
  const from = parseDateInput(range.fromDate)
  const to = parseDateInput(range.toDate)

  if (preset === "today") {
    return formatDay(from)
  }

  if (
    preset === "this_month" ||
    preset === "last_month" ||
    (from.getUTCFullYear() === to.getUTCFullYear() &&
      from.getUTCMonth() === to.getUTCMonth() &&
      from.getUTCDate() === 1 &&
      to.getUTCDate() === daysInMonth(to))
  ) {
    return new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(from)
  }

  return `${formatDay(from)} to ${formatDay(to)}`
}

export function formatOwnerExactRange(range: OwnerPeriodRange) {
  return `${formatDay(parseDateInput(range.fromDate))} to ${formatDay(
    parseDateInput(range.toDate)
  )}`
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function parseDateInput(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)

  return next
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function utcDate(date: Date) {
  return dateInput(
    new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    )
  )
}

function daysInMonth(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate()
}
