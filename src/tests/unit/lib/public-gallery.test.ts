import { describe, expect, it } from "vitest"

import { pickGalleryImage, pickRoomGalleryImage } from "@/lib/public-gallery"
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

  it("falls back to the generic room only when the employee room slot is missing", () => {
    expect(pickRoomGalleryImage([studentRoom, genericRoom], employeePlan)).toBe(
      "/generic-room.jpg"
    )
  })
})
