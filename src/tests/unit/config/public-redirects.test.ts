import { describe, expect, it } from "vitest"

import { publicRedirects } from "@/config/public-redirects"

describe("public redirects", () => {
  it("keeps login temporary and local SEO aliases permanent", async () => {
    const redirects = await publicRedirects()

    expect(redirects).toEqual(
      expect.arrayContaining([
        {
          source: "/login",
          destination: "/admin/login",
          permanent: false,
        },
        {
          source: "/hostel-in-pulivendula",
          destination: "/pulivendula-boys-hostel",
          permanent: true,
        },
        {
          source: "/boys-hostel-pulivendula",
          destination: "/pulivendula-boys-hostel",
          permanent: true,
        },
      ])
    )
  })

  it("does not redirect the canonical Pulivendula landing page", async () => {
    const redirects = await publicRedirects()

    expect(redirects.map((redirect) => redirect.source)).not.toContain(
      "/pulivendula-boys-hostel"
    )
  })
})
