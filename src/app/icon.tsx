import { ImageResponse } from "next/og"

import { BrandIconImage } from "@/components/seo/brand-icon-image"
import { getPublishedBrandIconUrl } from "@/lib/public-brand-logo"

export const size = {
  width: 192,
  height: 192,
}

export const contentType = "image/png"
export const revalidate = 60

export default async function Icon() {
  const logoUrl = await getPublishedBrandIconUrl()

  return new ImageResponse(<BrandIconImage logoUrl={logoUrl} />, size)
}
