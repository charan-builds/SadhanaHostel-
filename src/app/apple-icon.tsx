import { ImageResponse } from "next/og"

import { BrandIconImage } from "@/components/seo/brand-icon-image"
import { getPublishedBrandIconUrl } from "@/lib/public-brand-logo"

export const size = {
  width: 180,
  height: 180,
}

export const contentType = "image/png"
export const revalidate = 60

export default async function AppleIcon() {
  const logoUrl = await getPublishedBrandIconUrl()

  return new ImageResponse(<BrandIconImage logoUrl={logoUrl} />, size)
}
