import { describe, expect, it } from "vitest"

import { HOSTEL_RULES } from "@/constants/hostel"

describe("hostel public rules", () => {
  it("states that joined residents do not receive reversals or refunds when leaving", () => {
    expect(HOSTEL_RULES).toContain(
      "After joining the hostel, if a resident chooses to leave, paid hostel fees, advance, or other payments will not be reversed or refunded."
    )
  })
})
