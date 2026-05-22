import Link from "next/link"
import { Building2, ImageIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { fallbackGalleryItems } from "@/constants/public-content"
import type { GalleryItem } from "@/types/frontend"

export function GalleryPreview({
  galleryItems = fallbackGalleryItems,
}: {
  galleryItems?: GalleryItem[]
}) {
  const previewItems = galleryItems.slice(0, 4)

  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-blue-700">Gallery</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 text-balance sm:text-4xl">
              A quick look at the hostel spaces.
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href="/gallery">View Gallery</Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {previewItems.map((item, index) => (
            <article
              key={item.title}
              className="group overflow-hidden rounded-2xl border bg-white shadow-sm"
            >
              {item.imageUrl ? (
                <div
                  role="img"
                  aria-label={item.alt}
                  className="aspect-[4/3] bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.02]"
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
                <h3 className="font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{item.category}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
