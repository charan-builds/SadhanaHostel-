import type { Metadata } from "next"
import { describe, expect, it } from "vitest"

import { metadata as aboutMetadata } from "@/app/(public)/about/page"
import { metadata as contactMetadata } from "@/app/(public)/contact/page"
import { metadata as employeeHostelMetadata } from "@/app/(public)/employee-hostel-pulivendula/page"
import { metadata as facilitiesMetadata } from "@/app/(public)/facilities/page"
import { metadata as galleryMetadata } from "@/app/(public)/gallery/page"
import { metadata as homeMetadata } from "@/app/(public)/page"
import { metadata as pulivendulaHostelMetadata } from "@/app/(public)/pulivendula-boys-hostel/page"
import { metadata as roomsMetadata } from "@/app/(public)/rooms/page"
import { metadata as studentHostelMetadata } from "@/app/(public)/student-hostel-pulivendula/page"
import { metadata as supportMetadata } from "@/app/(public)/support/page"
import { metadata as termsMetadata } from "@/app/(public)/terms/page"

const publicPages = [
  { path: "/", metadata: homeMetadata },
  { path: "/about", metadata: aboutMetadata },
  { path: "/rooms", metadata: roomsMetadata },
  { path: "/facilities", metadata: facilitiesMetadata },
  { path: "/gallery", metadata: galleryMetadata },
  { path: "/contact", metadata: contactMetadata },
  { path: "/support", metadata: supportMetadata },
  { path: "/terms", metadata: termsMetadata },
  { path: "/pulivendula-boys-hostel", metadata: pulivendulaHostelMetadata },
  { path: "/student-hostel-pulivendula", metadata: studentHostelMetadata },
  { path: "/employee-hostel-pulivendula", metadata: employeeHostelMetadata },
] as const

describe("public page metadata", () => {
  it("keeps indexable public pages on unique canonical paths, titles, and descriptions", () => {
    const canonicals = publicPages.map((page) => canonicalPath(page.metadata))
    const titles = publicPages.map((page) => titleText(page.metadata))
    const descriptions = publicPages.map((page) => page.metadata.description)

    expect(canonicals).toEqual(publicPages.map((page) => page.path))
    expect(new Set(canonicals).size).toBe(publicPages.length)
    expect(new Set(titles).size).toBe(publicPages.length)
    expect(new Set(descriptions).size).toBe(publicPages.length)
  })

  it("keeps public metadata locally useful for Sadhana Boys Hostel Pulivendula search", () => {
    for (const page of publicPages) {
      const title = titleText(page.metadata)
      const description = String(page.metadata.description)

      expect(title.length, page.path).toBeGreaterThan(10)
      expect(description.length, page.path).toBeGreaterThan(80)
      expect(`${title} ${description}`, page.path).toMatch(/Sadhana Boys Hostel|Pulivendula/)
    }
  })

  it("does not publish generic support metadata", () => {
    expect(titleText(supportMetadata)).toBe("Support Sadhana Boys Hostel Pulivendula")
    expect(supportMetadata.description).toContain("Pulivendula")
    expect(supportMetadata.description).toContain("resident login")
  })
})

function titleText(metadata: Metadata) {
  const title = metadata.title

  if (typeof title === "string") {
    return title
  }

  if (title && typeof title === "object") {
    const templateTitle = title as {
      absolute?: string
      default?: string
    }

    return templateTitle.absolute ?? templateTitle.default ?? ""
  }

  return ""
}

function canonicalPath(metadata: Metadata) {
  const canonical = metadata.alternates?.canonical

  if (typeof canonical === "string") {
    return canonical
  }

  if (canonical instanceof URL) {
    return canonical.toString()
  }

  return canonical?.url.toString()
}
