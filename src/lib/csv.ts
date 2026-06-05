export function sanitizeCsvCell(value: unknown) {
  const normalized = value === undefined || value === null ? "" : String(value)

  return /^[=+@\t\r]/.test(normalized) ? `'${normalized}` : normalized
}

export function escapeCsvCell(value: unknown) {
  const normalized = sanitizeCsvCell(value)

  if (!/[",\n\r]/.test(normalized)) {
    return normalized
  }

  return `"${normalized.replace(/"/g, "\"\"")}"`
}
