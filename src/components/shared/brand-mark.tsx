import Image from "next/image"

import { hostelConfig } from "@/constants/hostel"
import { cn } from "@/lib/utils"

export function BrandMark({
  logoUrl,
  className,
  imageClassName,
}: {
  logoUrl?: string | null
  className?: string
  imageClassName?: string
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm",
        className
      )}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${hostelConfig.name} logo`}
          width={40}
          height={40}
          sizes="40px"
          className={cn("size-full object-cover", imageClassName)}
        />
      ) : (
        "SB"
      )}
    </span>
  )
}
