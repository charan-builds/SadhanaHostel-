"use client"

import { useMemo, useState } from "react"
import { Building2, ImageIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { galleryItems } from "@/data/public"
import { cn } from "@/lib/utils"

const categories = ["All", ...galleryItems.map((item) => item.title)] as const

export function GalleryPageContent() {
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All")

  const visibleItems = useMemo(() => {
    if (activeCategory === "All") {
      return galleryItems
    }

    return galleryItems.filter((item) => item.title === activeCategory)
  }, [activeCategory])

  return (
    <main className="flex flex-1 flex-col bg-white">
      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_76%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium text-blue-700">Gallery</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
            Hostel spaces, ready for future photo uploads.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Browse placeholder categories for exterior, courtyard, rooms, bathrooms, dining, and
            terrace views. The structure is ready for real media later.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Gallery category filters">
            {categories.map((category) => (
              <Button
                key={category}
                type="button"
                variant={activeCategory === category ? "default" : "outline"}
                size="sm"
                className={cn("shrink-0", activeCategory !== category && "bg-white")}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item, index) => (
              <article key={item.title} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#eff6ff_0%,#e2e8f0_100%)]">
                  {index === 0 ? (
                    <Building2 className="size-12 text-blue-700" aria-hidden="true" />
                  ) : (
                    <ImageIcon className="size-12 text-blue-700" aria-hidden="true" />
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{item.category}</p>
                  <p className="mt-3 text-xs text-slate-500">{item.alt}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
