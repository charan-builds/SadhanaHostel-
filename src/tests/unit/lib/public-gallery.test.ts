import { describe, expect, it } from "vitest"

import { fallbackGalleryItems } from "@/constants/public-content"
import { galleryItems as legacyPublicGalleryItems } from "@/data/public"
import { formatGalleryCategory, pickGalleryImage, pickRoomGalleryImage } from "@/lib/public-gallery"
import type { GalleryItem, RoomTypeCard } from "@/types/frontend"

const studentRoom: GalleryItem = {
  title: "Student room preview",
  category: "student-room",
  alt: "Student room",
  imageUrl: "/student-room.jpg",
}

const employeeRoom: GalleryItem = {
  title: "Employee room preview",
  category: "employee-room",
  alt: "Employee room",
  imageUrl: "/employee-room.jpg",
}

const genericRoom: GalleryItem = {
  title: "Room preview",
  category: "room",
  alt: "Room",
  imageUrl: "/generic-room.jpg",
}

const studentPlan: RoomTypeCard = {
  title: "College Students",
  price: 3500,
  priceLabel: "3500/month",
  description: "Student stay",
  features: [],
  icon: "graduation-cap",
}

const employeePlan: RoomTypeCard = {
  title: "Employees",
  price: 5000,
  priceLabel: "5000/month",
  description: "Employee stay",
  features: [],
  icon: "briefcase-business",
}

describe("public gallery image selection", () => {
  it("keeps student and employee room images independent from a generic room image", () => {
    const galleryItems = [genericRoom, studentRoom, employeeRoom]

    expect(pickRoomGalleryImage(galleryItems, studentPlan)).toBe("/student-room.jpg")
    expect(pickRoomGalleryImage(galleryItems, employeePlan)).toBe("/employee-room.jpg")
  })

  it("does not let a student room satisfy a generic room slot", () => {
    expect(pickGalleryImage([studentRoom, genericRoom], ["room"])).toBe("/generic-room.jpg")
  })

  it("does not use the old generic room category for employee room slots", () => {
    expect(pickRoomGalleryImage([studentRoom, genericRoom], employeePlan)).not.toBe(
      "/generic-room.jpg"
    )
  })

  it("formats the five public gallery categories requested by the hostel", () => {
    expect(formatGalleryCategory("logo")).toBe("Logo")
    expect(formatGalleryCategory("student-room")).toBe("Student rooms")
    expect(formatGalleryCategory("employee-room")).toBe("Employee rooms")
    expect(formatGalleryCategory("open-space-terrace")).toBe("Open space / Terrace")
    expect(formatGalleryCategory("exterior-surroundings")).toBe("Exterior / Surroundings")
  })

  it("keeps fallback gallery copy aligned with actual shared hostel facilities", () => {
    const fallbackCopy = fallbackGalleryItems
      .flatMap((item) => [item.title, item.category, item.alt])
      .join(" ")
      .toLowerCase()

    expect(fallbackCopy).not.toContain("bathroom")
    expect(fallbackCopy).not.toContain("attached bath")
    expect(fallbackCopy).toContain("water facility")
  })

  it("keeps public gallery alt text branded for Pulivendula image search", () => {
    const publicGalleryItems = [...fallbackGalleryItems, ...legacyPublicGalleryItems]

    for (const item of publicGalleryItems) {
      const altText = item.alt.toLowerCase()

      expect(altText).toContain("sadhana boys hostel")
      expect(altText).toContain("pulivendula")
    }
  })
})
