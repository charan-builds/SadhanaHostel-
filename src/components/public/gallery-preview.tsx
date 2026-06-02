"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Building2, ImageIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { fallbackGalleryItems } from "@/constants/public-content"
import { formatGalleryCategory, hydrateGalleryItems } from "@/lib/public-gallery"
import type { GalleryItem } from "@/types/frontend"

export function GalleryPreview({
  galleryItems = fallbackGalleryItems,
}: {
  galleryItems?: GalleryItem[]
}) {
  const previewItems = hydrateGalleryItems(galleryItems).slice(0, 6)

  return (
    <section className="bg-background py-14 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">Gallery</p>
            <h2 className="text-gradient mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              A quick look at the hostel spaces.
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href="/gallery">View Gallery</Link>
          </Button>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {previewItems.map((item, index) => (
            <motion.article
              key={galleryItemKey(item, index)}
              variants={{
                hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
                show: { opacity: 1, y: 0, filter: "blur(0px)" },
              }}
              className={index === 0 ? "group overflow-hidden rounded-2xl border bg-card shadow-soft sm:col-span-2" : "group overflow-hidden rounded-2xl border bg-card shadow-soft"}
            >
              {item.imageUrl?.startsWith("/") ? (
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={item.imageUrl}
                    alt={item.alt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    loading={index === 0 ? "eager" : "lazy"}
                    sizes={index === 0 ? "(min-width: 1024px) 66vw, 100vw" : "(min-width: 1024px) 33vw, 100vw"}
                  />
                </div>
              ) : item.imageUrl ? (
                <div
                  role="img"
                  aria-label={item.alt}
                  className="aspect-[4/3] bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                  style={{ backgroundImage: `url("${item.imageUrl}")` }}
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#eff6ff_0%,#e2e8f0_100%)]">
                  {index === 0 ? (
                    <Building2 className="size-10 text-blue-700" aria-hidden="true" />
                  ) : (
                    <ImageIcon className="size-10 text-blue-700" aria-hidden="true" />
                  )}
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatGalleryCategory(item.category)}
                </p>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function galleryItemKey(item: GalleryItem, index: number) {
  return `${item.category}-${item.title}-${item.imageUrl ?? index}-${index}`
}
