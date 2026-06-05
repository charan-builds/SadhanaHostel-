import { describe, expect, it } from "vitest"

import {
  contentType as appleIconContentType,
  size as appleIconSize,
} from "@/app/apple-icon"
import {
  contentType as iconContentType,
  size as iconSize,
} from "@/app/icon"
import manifest from "@/app/manifest"

describe("app icon metadata", () => {
  it("generates PNG app icons for browser and search identity surfaces", () => {
    expect(iconSize).toEqual({ width: 192, height: 192 })
    expect(iconContentType).toBe("image/png")
    expect(appleIconSize).toEqual({ width: 180, height: 180 })
    expect(appleIconContentType).toBe("image/png")
  })

  it("advertises branded app icons in the web manifest", () => {
    const output = manifest()

    expect(output.name).toBe("Sadhana Boys Hostel Pulivendula")
    expect(output.short_name).toBe("Sadhana Hostel")
    expect(output.lang).toBe("en-IN")
    expect(output.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icon",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/apple-icon",
          sizes: "180x180",
          type: "image/png",
        }),
      ])
    )
    expect(output.icons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/favicon.ico",
        }),
      ])
    )
  })
})
