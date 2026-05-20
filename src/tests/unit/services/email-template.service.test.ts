import { describe, expect, it } from "vitest"

import { EmailTemplateService } from "@/services/email"

describe("EmailTemplateService", () => {
  it("renders payment receipt templates with escaped HTML", () => {
    const template = new EmailTemplateService().render("payment_receipt", {
      title: "Payment <verified>",
      body: "Thank you & welcome",
      payload: {
        amount: 6500,
        payment_id: "pay-1",
        invoice_number: "INV-1",
      },
    })

    expect(template.subject).toContain("Payment receipt")
    expect(template.html).toContain("Payment &lt;verified&gt;")
    expect(template.html).toContain("₹6,500.00")
    expect(template.text).toContain("Payment ID: pay-1")
  })

  it("falls back to the generic notification template", () => {
    const template = new EmailTemplateService().render("unknown", {
      title: "Notice",
      body: "Body",
      payload: {},
    })

    expect(template.subject).toBe("Notice")
    expect(template.text).toContain("Hostel notification")
  })
})
