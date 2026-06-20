export type OwnerPeriodPreset =
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "custom"

export type OwnerPeriodRange = {
  fromDate: string
  toDate: string
}

export const OWNER_PERIOD_PRESETS: Array<{
  value: OwnerPeriodPreset
  label: string
}> = [
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Date Range" },
]

export function getOwnerPeriodRange(
  preset: Exclude<OwnerPeriodPreset, "custom">,
  now = new Date()
): OwnerPeriodRange {
  const today = utcDate(now)
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()

  if (preset === "day") {
    return { fromDate: today, toDate: today }
  }

  if (preset === "week") {
    const start = new Date(
      Date.UTC(year, month, now.getUTCDate() - mondayOffset(now))
    )

    return {
      fromDate: dateInput(start),
      toDate: today,
    }
  }

  if (preset === "month") {
    return {
      fromDate: dateInput(new Date(Date.UTC(year, month, 1))),
      toDate: today,
    }
  }

  if (preset === "quarter") {
    const quarterStartMonth = Math.floor(month / 3) * 3

    return {
      fromDate: dateInput(new Date(Date.UTC(year, quarterStartMonth, 1))),
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

  if (preset === "day") {
    const previousDay = addUtcDays(from, -1)

    return {
      fromDate: dateInput(previousDay),
      toDate: dateInput(previousDay),
    }
  }

  if (preset === "month") {
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

  if (preset === "quarter") {
    const previousStart = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 3, 1)
    )
    const elapsedDays =
      Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1
    const previousEnd = addUtcDays(previousStart, elapsedDays - 1)

    return {
      fromDate: dateInput(previousStart),
      toDate: dateInput(previousEnd),
    }
  }

  if (preset === "year") {
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

  if (preset === "day") {
    return formatDay(from)
  }

  if (
    preset === "month" ||
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

  if (preset === "quarter") {
    return `Q${Math.floor(from.getUTCMonth() / 3) + 1} ${from.getUTCFullYear()}`
  }

  if (
    preset === "year" ||
    (from.getUTCMonth() === 0 &&
      from.getUTCDate() === 1 &&
      to.getUTCMonth() === 11 &&
      to.getUTCDate() === 31 &&
      from.getUTCFullYear() === to.getUTCFullYear())
  ) {
    return String(from.getUTCFullYear())
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

function mondayOffset(date: Date) {
  return (date.getUTCDay() + 6) % 7
}
