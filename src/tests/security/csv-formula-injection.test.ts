import { describe, expect, it } from "vitest"

import { escapeCsvCell, sanitizeCsvCell } from "@/lib/csv"

describe("CSV formula injection hardening", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "@cmd", "\t=1+1", "\r=1+1"])(
    "prefixes dangerous cell value %s",
    (value) => {
      expect(sanitizeCsvCell(value)).toBe(`'${value}`)
    }
  )

  it("escapes sanitized formula values inside quoted CSV cells", () => {
    expect(escapeCsvCell("=SUM(A1:A2),ok")).toBe("\"'=SUM(A1:A2),ok\"")
  })

  it("leaves normal values unchanged", () => {
    expect(escapeCsvCell("Sadhana Hostel")).toBe("Sadhana Hostel")
  })
})
