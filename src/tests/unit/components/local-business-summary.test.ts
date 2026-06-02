import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { LocalBusinessSummary } from "@/components/public/local-business-summary"
import {
  callHref,
  hostelConfig,
  mapSearchHref,
  whatsappHref,
} from "@/constants/hostel"

describe("LocalBusinessSummary", () => {
  it("renders consistent local business facts for Pulivendula landing pages", () => {
    const html = renderToStaticMarkup(React.createElement(LocalBusinessSummary))

    expect(html).toContain(hostelConfig.name)
    expect(html).toContain(hostelConfig.location.address)
    expect(html).toContain(hostelConfig.location.note)
    expect(html).toContain(`+91 ${hostelConfig.contact.phone}`)
    expect(html).toContain(`+91 ${hostelConfig.contact.whatsapp}`)
    expect(html).toContain("₹3,500/month")
    expect(html).toContain("₹5,000/month")
    expect(html).toContain(`href="${callHref}"`)
    expect(html).toContain(encodeHtmlAttribute(mapSearchHref))
    expect(html).toContain(encodeHtmlAttribute(whatsappHref))
  })
})

function encodeHtmlAttribute(value: string) {
  return value.replaceAll("&", "&amp;")
}
