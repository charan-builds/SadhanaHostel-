import { ImageResponse } from "next/og"

import {
  BrandSocialImage,
  socialImageAlt,
  socialImageSize,
} from "@/components/seo/brand-social-image"

export const alt = socialImageAlt
export const size = socialImageSize
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(<BrandSocialImage />, size)
}
