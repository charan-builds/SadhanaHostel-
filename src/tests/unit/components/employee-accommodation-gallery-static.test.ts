import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("employee accommodation gallery management", () => {
  it("exposes admin controls for employee room metadata, visibility, order, and images", () => {
    const manager = readFileSync(
      join(root, "src/components/admin/gallery/employee-accommodation-gallery-manager.tsx"),
      "utf8"
    )
    const galleryPage = readFileSync(
      join(root, "src/components/admin/gallery/admin-gallery-client.tsx"),
      "utf8"
    )

    expect(galleryPage).toContain("EmployeeAccommodationGalleryManager")
    expect(manager).toContain("Employee Accommodation Gallery Management")
    expect(manager).toContain("Add current rooms")
    expect(manager).toContain("Add room")
    expect(manager).toContain("Upload employee room images")
    expect(manager).toContain("Room title")
    expect(manager).toContain("Description")
    expect(manager).toContain("Capacity")
    expect(manager).toContain("Display order")
    expect(manager).toContain("Visible")
    expect(manager).toContain("Amenities")
    expect(manager).toContain("employee-room")
    expect(manager).not.toContain("hostelImages")
    expect(manager).not.toContain("hardcoded room image")
  })

  it("loads employee room images by room-specific gallery categories", () => {
    const repository = readFileSync(
      join(root, "src/repositories/website.repository.ts"),
      "utf8"
    )
    const service = readFileSync(join(root, "src/services/website.service.ts"), "utf8")

    expect(repository).toContain("categories?: string[]")
    expect(repository).toContain('query.in("category", filters.categories)')
    expect(service).toContain("listGalleryItemsByCategories")
    expect(service).toContain("categories: roomCategories")
    expect(service).toContain("while (items.length < total)")
  })

  it("renders public employee accommodation rooms from CMS data with lazy images", () => {
    const section = readFileSync(
      join(root, "src/components/public/employee-accommodation-rooms-section.tsx"),
      "utf8"
    )
    const page = readFileSync(
      join(root, "src/app/(public)/employee-hostel-pulivendula/page.tsx"),
      "utf8"
    )
    const audienceContent = readFileSync(
      join(root, "src/components/public/audience-hostel-page-content.tsx"),
      "utf8"
    )

    expect(page).toContain("getPublicCmsContent")
    expect(page).toContain("employeeAccommodationRooms={cmsContent.employeeAccommodationRooms}")
    expect(audienceContent).toContain("EmployeeAccommodationRoomsSection")
    expect(section).toContain("Employee accommodation rooms")
    expect(section).toContain("room.images")
    expect(section).toContain("room.capacity")
    expect(section).toContain("room.amenities")
    expect(section).toContain('"lazy"')
    expect(section).toContain("fetchPriority")
    expect(section).not.toContain("hostelImages")
  })

  it("keeps public rendering quiet before the employee rooms migration is applied", () => {
    const repository = readFileSync(
      join(root, "src/repositories/website.repository.ts"),
      "utf8"
    )

    expect(repository).toContain("employee_accommodation_rooms")
    expect(repository).toContain("PGRST205")
    expect(repository).toContain('filters.status === "published"')
    expect(repository).toContain("!filters.includeHidden")
    expect(repository).toContain("Unable to list employee accommodation rooms.")
  })
})
