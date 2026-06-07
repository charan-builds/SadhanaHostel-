import { ImageResponse } from "next/og"

import { BrandIconImage } from "@/components/seo/brand-icon-image"
import { getPublishedBrandIconUrl } from "@/lib/public-brand-logo"

export const revalidate = 60

type PwaIconRouteContext = {
  params: Promise<{ size: string }>
}

export async function GET(_request: Request, context: PwaIconRouteContext) {
  const { size: rawSize } = await context.params
  const size = normalizeSize(rawSize)
  const logoUrl = await getPublishedBrandIconUrl()

  return new ImageResponse(<BrandIconImage logoUrl={logoUrl} />, {
    width: size,
    height: size,
  })
}

function normalizeSize(value: string) {
  const parsed = Number(value)

  return [96, 192, 512].includes(parsed) ? parsed : 192
}
