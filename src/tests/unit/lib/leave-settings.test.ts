import { describe, expect, it } from "vitest"

import {
  buildUrgentLeaveWhatsappMessage,
  DEFAULT_LEAVE_REVIEW_NOTICE,
  readLeaveManagementSettings,
} from "@/lib/leaves/settings"

describe("leave management settings", () => {
  it("reads leave settings with safe defaults", () => {
    expect(readLeaveManagementSettings({})).toEqual({
      whatsappSupportNumber: "",
      reviewNotice: DEFAULT_LEAVE_REVIEW_NOTICE,
      urgentWhatsappEscalationEnabled: true,
    })
  })

  it("falls back to operational support WhatsApp when leave support is not set", () => {
    expect(
      readLeaveManagementSettings({
        operationalControls: {
          support: {
            whatsapp: "90000 00009",
          },
        },
      }).whatsappSupportNumber
    ).toBe("90000 00009")
  })

  it("builds the urgent leave WhatsApp message with submitted contact details", () => {
    const message = buildUrgentLeaveWhatsappMessage({
      studentName: "Resident User",
      mobileNumber: "+91 90000 00002",
    })

    expect(message).toContain(
      "Hello, I have submitted an urgent leave request and would appreciate faster review."
    )
    expect(message).toContain("Student Name: Resident User")
    expect(message).toContain("Mobile Number: +91 90000 00002")
  })
})
