import { describe, expect, it } from "vitest"

import {
  alt as openGraphAlt,
  contentType as openGraphContentType,
  size as openGraphSize,
} from "@/app/opengraph-image"
import {
  alt as twitterAlt,
  contentType as twitterContentType,
  size as twitterSize,
} from "@/app/twitter-image"

describe("social image metadata", () => {
  it("uses launch-safe Open Graph image metadata for hostel search previews", () => {
    expect(openGraphAlt).toContain("Sadhana Boys Hostel Pulivendula")
    expect(openGraphAlt).toContain("student and employee hostel")
    expect(openGraphSize).toEqual({ width: 1200, height: 630 })
    expect(openGraphContentType).toBe("image/png")
  })

  it("keeps Twitter image metadata aligned with Open Graph metadata", () => {
    expect(twitterAlt).toBe(openGraphAlt)
    expect(twitterSize).toBe(openGraphSize)
    expect(twitterContentType).toBe(openGraphContentType)
  })
})
