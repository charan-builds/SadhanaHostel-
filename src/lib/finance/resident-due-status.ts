export type FeeDueStatus = {
  amountDue: number
  dueDate: string
  label: string
  className: string
  tone: "success" | "warning" | "urgent" | "danger"
}

export function buildFeeDueStatus(input: {
  amountDue: number
  dueDate: string
  today?: Date
}): FeeDueStatus {
  const days = daysUntil(input.dueDate, input.today)

  if (days < 0) {
    return {
      amountDue: input.amountDue,
      dueDate: input.dueDate,
      label: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`,
      className: "border-red-200 bg-red-50 text-red-950",
      tone: "danger",
    }
  }

  if (days === 0) {
    return {
      amountDue: input.amountDue,
      dueDate: input.dueDate,
      label: "Due today",
      className: "border-orange-200 bg-orange-50 text-orange-950",
      tone: "urgent",
    }
  }

  if (days === 1) {
    return {
      amountDue: input.amountDue,
      dueDate: input.dueDate,
      label: "Due tomorrow",
      className: "border-orange-200 bg-orange-50 text-orange-950",
      tone: "urgent",
    }
  }

  if (days < 7) {
    return {
      amountDue: input.amountDue,
      dueDate: input.dueDate,
      label: `Due in ${days} days`,
      className: "border-yellow-200 bg-yellow-50 text-yellow-950",
      tone: "warning",
    }
  }

  return {
    amountDue: input.amountDue,
    dueDate: input.dueDate,
    label: `Due in ${days} days`,
    className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    tone: "success",
  }
}

function daysUntil(dateOnly: string, todayDate = new Date()) {
  const now = todayDate
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const [year, month, day] = dateOnly.slice(0, 10).split("-").map(Number)
  const due = Date.UTC(year, month - 1, day)

  return Math.round((due - today) / 86_400_000)
}
