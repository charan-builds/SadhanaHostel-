import { describe, expect, it } from "vitest"

import {
  getInvoiceHostelAddressLines,
  getInvoiceHostelContactLine,
  type InvoiceTemplateData,
} from "@/services/invoices/invoice-template"

describe("invoice template address helpers", () => {
  it("prefers hostel address details over organization address details", () => {
    const data = templateAddressData({
      hostel: {
        address_line1: "2-3-161 Jandaman Street",
        address_line2: "Near City Bus Stand",
        city: "Pulivendula",
        state: "Andhra Pradesh",
        postal_code: "516390",
      },
      organization: {
        address_line1: "Fallback organization address",
      },
    })

    expect(getInvoiceHostelAddressLines(data)).toEqual([
      "Sadhana Boys Hostel",
      "2-3-161 Jandaman Street, Near City Bus Stand, Pulivendula, Andhra Pradesh, 516390",
    ])
  })

  it("falls back to organization address when the hostel address is not set", () => {
    const data = templateAddressData({
      hostel: {
        address_line1: "   ",
      },
      organization: {
        address_line1: "Main office road",
        city: "Tirupati",
        state: "Andhra Pradesh",
        postal_code: "517501",
      },
    })

    expect(getInvoiceHostelAddressLines(data)).toEqual([
      "Sadhana Boys Hostel",
      "Main office road, Tirupati, Andhra Pradesh, 517501",
    ])
  })

  it("prefers hostel contact details in the footer contact line", () => {
    const data = templateAddressData({
      hostel: {
        phone: "+91 90000 00001",
        email: "hostel@sadhanahostel.example",
      },
      organization: {
        contact_phone: "+91 90000 00002",
        billing_email: "billing@sadhanahostel.example",
      },
    })

    expect(getInvoiceHostelContactLine(data)).toBe(
      "Phone: +91 90000 00001 | Email: hostel@sadhanahostel.example"
    )
  })
})

function templateAddressData(overrides: {
  organization?: Partial<InvoiceTemplateData["organization"]>
  hostel?: Partial<InvoiceTemplateData["hostel"]>
} = {}): Pick<InvoiceTemplateData, "organization" | "hostel"> {
  return {
    organization: {
      name: "Sadhana Boys Hostel",
      legal_name: "Sadhana Boys Hostel",
      billing_email: null,
      contact_phone: null,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      ...overrides.organization,
    },
    hostel: {
      name: "Sadhana Boys Hostel",
      code: "SBH",
      phone: null,
      email: null,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      ...overrides.hostel,
    },
  }
}
