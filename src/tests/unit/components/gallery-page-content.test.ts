import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { GalleryPageContent } from "@/components/public/gallery-page-content"
import type { GalleryItem } from "@/types/frontend"

const galleryItems: GalleryItem[] = [
  {
    title: "Main exterior",
    category: "Hostel",
    alt: "Sadhana Boys Hostel exterior view in Pulivendula",
    imageUrl: "/images/hostel-exterior-wide.webp",
  },
  {
    title: "Student room preview",
    category: "student-room",
    alt: "Student room setup at Sadhana Boys Hostel Pulivendula",
    imageUrl: "/images/student-room.webp",
  },
  {
    title: "Employee room preview",
    category: "employee-room",
    alt: "Employee room setup at Sadhana Boys Hostel Pulivendula",
    imageUrl: "https://cms.example.test/gallery/employee-room.webp",
  },
]

describe("GalleryPageContent", () => {
  it("renders the advanced gallery with CMS-driven filters and counts", () => {
    const html = renderToStaticMarkup(
      React.createElement(GalleryPageContent, { galleryItems })
    )

    expect(html).toContain("Hostel spaces and published media.")
    expect(html).toContain("All photos")
    expect(html).toContain("Student rooms")
    expect(html).toContain("Employee rooms")
    expect(html).toContain("Showing 3 of 3 published photos")
    expect(html).toContain("Sadhana Boys Hostel exterior view in Pulivendula")
  })
})
