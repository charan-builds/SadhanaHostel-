import { ImageResponse } from "next/og"

import { BrandIconImage } from "@/components/seo/brand-icon-image"

export const size = {
  width: 192,
  height: 192,
}

export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(<BrandIconImage />, size)
}
