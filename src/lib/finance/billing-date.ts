export type ResidentBillingContext = {
  joinedOn: string | null
  billingDay: number
  currentPeriodMonth: string
  currentDueDate: string
  nextPeriodDueDate: string
}

export function billingDayFromJoinedOn(joinedOn: string | null | undefined, fallbackDay = 10) {
  if (!joinedOn) {
    return clampBillingDay(fallbackDay)
  }

  const parsed = Number(joinedOn.slice(8, 10))

  return clampBillingDay(Number.isFinite(parsed) ? parsed : fallbackDay)
}

export function buildBillingDateForMonth(periodMonth: string, billingDay: number) {
  const monthStart = parseDateOnly(`${periodMonth.slice(0, 7)}-01`)

  return buildBillingDate({
    year: monthStart.getUTCFullYear(),
    monthIndex: monthStart.getUTCMonth(),
    billingDay,
  })
}

export function buildResidentBillingContext(input: {
  joinedOn: string | null | undefined
  today?: string
  fallbackDay?: number
}): ResidentBillingContext {
  const today = parseDateOnly(input.today ?? todayDateOnly())
  const billingDay = billingDayFromJoinedOn(input.joinedOn, input.fallbackDay)

  return {
    joinedOn: input.joinedOn ?? null,
    billingDay,
    currentPeriodMonth: toPeriodMonth(today),
    currentDueDate: buildBillingDate({
      year: today.getUTCFullYear(),
      monthIndex: today.getUTCMonth(),
      billingDay,
    }),
    nextPeriodDueDate: buildBillingDate({
      year: today.getUTCFullYear(),
      monthIndex: today.getUTCMonth() + 1,
      billingDay,
    }),
  }
}

export function resolveNextBillingDueDate(input: {
  billing: ResidentBillingContext
  today?: string
}) {
  const today = input.today ?? todayDateOnly()

  if (input.billing.currentDueDate >= today) {
    return input.billing.currentDueDate
  }

  return input.billing.nextPeriodDueDate
}

export function toPeriodMonth(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-01`
}

export function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

export function parseDateOnly(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function buildBillingDate(input: {
  year: number
  monthIndex: number
  billingDay: number
}) {
  const monthStart = new Date(Date.UTC(input.year, input.monthIndex, 1))
  const lastDay = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)
  ).getUTCDate()
  const dueDay = Math.min(clampBillingDay(input.billingDay), lastDay)

  return `${monthStart.getUTCFullYear()}-${pad2(monthStart.getUTCMonth() + 1)}-${pad2(dueDay)}`
}

function clampBillingDay(value: number) {
  return Math.min(Math.max(1, Math.trunc(value)), 31)
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}
