import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { LanguageSwitcher } from "@/components/public/language-switcher"

describe("LanguageSwitcher", () => {
  it("exposes English and Telugu translation controls for the public website", () => {
    const html = renderToStaticMarkup(React.createElement(LanguageSwitcher))

    expect(html).toContain("Translate website")
    expect(html).toContain("Translate website to English")
    expect(html).toContain("Translate website to Telugu")
    expect(html).toContain("తెలుగు")
    expect(html).toContain("sadhana-google-translate")
  })
})
