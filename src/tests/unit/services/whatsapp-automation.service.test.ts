import { describe, expect, it } from "vitest"

import {
  extractVariables,
  renderTemplate,
} from "@/services/whatsapp/whatsapp-automation.service"

describe("WhatsappAutomationService template helpers", () => {
  it("extracts unique template variables in first-seen order", () => {
    expect(
      extractVariables(
        "Hello {{ residentName }}, {{amount}} is due. Ref {{amount}} / {{ dueDate }}."
      )
    ).toEqual(["residentName", "amount", "dueDate"])
  })

  it("renders message previews with blank values for missing variables", () => {
    expect(
      renderTemplate(
        "Hello {{residentName}}, invoice {{invoiceNumber}} amount {{amount}}.",
        {
          residentName: "Charan",
          amount: "INR 5,000",
        }
      )
    ).toBe("Hello Charan, invoice  amount INR 5,000.")
  })
})
