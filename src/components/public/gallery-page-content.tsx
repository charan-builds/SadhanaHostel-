"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import {
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Expand,
  Grid3X3,
  ImageIcon,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fallbackGalleryItems } from "@/constants/public-content"
import { formatGalleryCategory, hydrateGalleryItems } from "@/lib/public-gallery"
import { cn } from "@/lib/utils"
import type { GalleryItem } from "@/types/frontend"

const allPhotosFilterId = "all"

export function GalleryPageContent({
  galleryItems = fallbackGalleryItems,
}: {
  galleryItems?: GalleryItem[]
}) {
  const hydratedItems = useMemo(
    () => hydrateGalleryItems(galleryItems),
    [galleryItems]
  )
  const filters = useMemo(
    () => buildGalleryFilters(hydratedItems),
    [hydratedItems]
  )
  const [activeFilter, setActiveFilter] = useState(allPhotosFilterId)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  const activeFilterId = filters.some((filter) => filter.id === activeFilter)
    ? activeFilter
    : allPhotosFilterId
  const visibleItems = useMemo(() => {
    if (activeFilterId === allPhotosFilterId) {
      return hydratedItems
    }

    return hydratedItems.filter((item) => normalizeFilterKey(item.category) === activeFilterId)
  }, [activeFilterId, hydratedItems])

  const selectedItemIndex = Math.min(selectedIndex, Math.max(visibleItems.length - 1, 0))
  const selectedItem = visibleItems[selectedItemIndex] ?? hydratedItems[0]
  const selectedCategoryLabel = selectedItem
    ? formatGalleryCategory(selectedItem.category)
    : "Gallery"

  function handleFilterChange(filterId: string) {
    setActiveFilter(filterId)
    setSelectedIndex(0)
  }

  function handleSelectImage(index: number, openLightbox = false) {
    setSelectedIndex(index)
    setIsLightboxOpen(openLightbox)
  }

  function moveSelection(direction: -1 | 1) {
    if (visibleItems.length < 2) {
      return
    }

    setSelectedIndex((currentIndex) => {
      const safeIndex = Math.min(currentIndex, visibleItems.length - 1)

      return (safeIndex + direction + visibleItems.length) % visibleItems.length
    })
  }

  if (!selectedItem) {
    return null
  }

  return (
    <main className="flex flex-1 flex-col bg-white">
      <section className="relative isolate min-h-[560px] overflow-hidden bg-slate-950 text-white sm:min-h-[640px]">
        <GalleryImageFrame
          item={selectedItem}
          className="absolute inset-0"
          imageClassName="scale-[1.02] object-cover opacity-70"
          preload
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.9)_0%,rgba(2,6,23,0.58)_52%,rgba(15,23,42,0.2)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(2,6,23,0.72)_100%)]" />

        <div className="relative mx-auto flex min-h-[560px] max-w-7xl flex-col justify-end px-4 py-10 sm:min-h-[640px] sm:px-6 sm:py-14">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <Camera className="size-4" aria-hidden="true" />
              Gallery
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold text-balance sm:text-6xl">
              Hostel spaces and published media before residents arrive.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-100 sm:text-lg">
              Browse exterior views, resident rooms, food, facilities, and common spaces from the
              photos published by hostel management.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-white/20 pt-5 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="flex gap-2 overflow-x-auto pb-2"
              aria-label="Gallery category filters"
            >
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition",
                    activeFilterId === filter.id
                      ? "border-white bg-white text-slate-950 shadow-lg shadow-slate-950/20"
                      : "border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20"
                  )}
                  onClick={() => handleFilterChange(filter.id)}
                >
                  <span>{filter.label}</span>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-xs",
                      activeFilterId === filter.id ? "bg-slate-950/10" : "bg-white/15"
                    )}
                  >
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-sm text-slate-200">
              Showing {visibleItems.length} of {hydratedItems.length} published photos
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_78%)] px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="relative overflow-hidden rounded-lg border bg-slate-950 shadow-soft">
              <GalleryImageFrame
                item={selectedItem}
                className="aspect-[16/10]"
                imageClassName="object-cover"
                sizes="(min-width: 1024px) 72vw, 100vw"
              />
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(2,6,23,0.88)_100%)] p-4 text-white sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  {selectedCategoryLabel}
                </p>
                <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{selectedItem.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
                  {selectedItem.alt}
                </p>
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-white/25 bg-slate-950/35 text-white backdrop-blur hover:bg-white hover:text-slate-950"
                  onClick={() => moveSelection(-1)}
                  disabled={visibleItems.length < 2}
                  aria-label="Previous gallery photo"
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-white/25 bg-slate-950/35 text-white backdrop-blur hover:bg-white hover:text-slate-950"
                  onClick={() => moveSelection(1)}
                  disabled={visibleItems.length < 2}
                  aria-label="Next gallery photo"
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-white/25 bg-slate-950/35 text-white backdrop-blur hover:bg-white hover:text-slate-950"
                  onClick={() => setIsLightboxOpen(true)}
                  aria-label="Open selected gallery photo"
                >
                  <Expand aria-hidden="true" />
                </Button>
              </div>
            </div>

            <aside className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Now viewing</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    {selectedCategoryLabel}
                  </h2>
                </div>
                <div className="rounded-lg bg-cyan-50 p-3 text-cyan-700">
                  <Grid3X3 className="size-5" aria-hidden="true" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {visibleItems.map((item, index) => (
                  <button
                    key={galleryItemKey(item, index)}
                    type="button"
                    className={cn(
                      "group relative overflow-hidden rounded-lg border text-left transition",
                      selectedItemIndex === index
                        ? "border-cyan-500 ring-2 ring-cyan-500/25"
                        : "border-slate-200 hover:border-cyan-300"
                    )}
                    onClick={() => handleSelectImage(index)}
                    aria-label={`Preview ${item.title}`}
                  >
                    <GalleryImageFrame
                      item={item}
                      index={index}
                      className="aspect-square"
                      imageClassName="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="8rem"
                    />
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-950">{selectedItem.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedItem.alt}</p>
              </div>
            </aside>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item, index) => (
              <button
                key={galleryItemKey(item, index)}
                type="button"
                className={cn(
                  "group overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lifted",
                  index === 0 && visibleItems.length > 3 ? "sm:col-span-2" : ""
                )}
                onClick={() => handleSelectImage(index, true)}
              >
                <div className="relative overflow-hidden">
                  <GalleryImageFrame
                    item={item}
                    index={index}
                    className="aspect-[4/3]"
                    imageClassName="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes={
                      index === 0 && visibleItems.length > 3
                        ? "(min-width: 1024px) 66vw, 100vw"
                        : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    }
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-[linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(2,6,23,0.82)_100%)] p-4 text-white">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
                        {formatGalleryCategory(item.category)}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold">{item.title}</h2>
                    </div>
                    <span className="rounded-lg bg-white/15 p-2 backdrop-blur">
                      <Expand className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>
                <p className="p-4 text-sm leading-6 text-slate-600">{item.alt}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent
          className="max-w-[min(96vw,72rem)] gap-0 overflow-hidden border-0 bg-slate-950 p-0 text-white sm:max-w-[min(96vw,72rem)]"
          showCloseButton={false}
        >
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-20 bg-slate-950/45 text-white backdrop-blur hover:bg-white hover:text-slate-950"
              aria-label="Close gallery viewer"
            >
              <X aria-hidden="true" />
            </Button>
          </DialogClose>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="relative min-h-[360px] bg-slate-950">
              <GalleryImageFrame
                item={selectedItem}
                className="h-[64vh] min-h-[360px]"
                imageClassName="object-contain"
                fit="contain"
                sizes="(min-width: 1024px) 72vw, 96vw"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute top-1/2 left-3 -translate-y-1/2 border-white/25 bg-slate-950/45 text-white backdrop-blur hover:bg-white hover:text-slate-950"
                onClick={() => moveSelection(-1)}
                disabled={visibleItems.length < 2}
                aria-label="Previous gallery photo"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute top-1/2 right-3 -translate-y-1/2 border-white/25 bg-slate-950/45 text-white backdrop-blur hover:bg-white hover:text-slate-950"
                onClick={() => moveSelection(1)}
                disabled={visibleItems.length < 2}
                aria-label="Next gallery photo"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>

            <div className="border-t border-white/10 p-5 lg:border-t-0 lg:border-l">
              <DialogHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  {selectedCategoryLabel}
                </p>
                <DialogTitle className="text-xl text-white">{selectedItem.title}</DialogTitle>
                <DialogDescription className="text-slate-300">
                  {selectedItem.alt}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 grid grid-cols-4 gap-2 lg:grid-cols-3">
                {visibleItems.map((item, index) => (
                  <button
                    key={galleryItemKey(item, index)}
                    type="button"
                    className={cn(
                      "overflow-hidden rounded-lg border transition",
                      selectedItemIndex === index
                        ? "border-cyan-300 ring-2 ring-cyan-300/30"
                        : "border-white/10 hover:border-white/40"
                    )}
                    onClick={() => handleSelectImage(index)}
                    aria-label={`Show ${item.title}`}
                  >
                    <GalleryImageFrame
                      item={item}
                      index={index}
                      className="aspect-square"
                      imageClassName="object-cover"
                      sizes="7rem"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

type GalleryFilter = {
  id: string
  label: string
  count: number
}

function buildGalleryFilters(items: GalleryItem[]): GalleryFilter[] {
  const filters = new Map<string, GalleryFilter>()

  for (const item of items) {
    const id = normalizeFilterKey(item.category)
    const existingFilter = filters.get(id)

    if (existingFilter) {
      existingFilter.count += 1
      continue
    }

    filters.set(id, {
      id,
      label: formatGalleryCategory(item.category),
      count: 1,
    })
  }

  return [
    {
      id: allPhotosFilterId,
      label: "All photos",
      count: items.length,
    },
    ...Array.from(filters.values()),
  ]
}

type GalleryImageFrameProps = {
  item: GalleryItem
  index?: number
  className?: string
  imageClassName?: string
  fit?: "cover" | "contain"
  preload?: boolean
  sizes?: string
}

function GalleryImageFrame({
  item,
  index = 0,
  className,
  imageClassName,
  fit = "cover",
  preload = false,
  sizes = "100vw",
}: GalleryImageFrameProps) {
  if (item.imageUrl?.startsWith("/")) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image
          src={item.imageUrl}
          alt={item.alt}
          fill
          className={cn("object-cover", imageClassName)}
          sizes={sizes}
          {...(preload ? { preload: true } : { loading: "lazy" as const })}
        />
      </div>
    )
  }

  if (item.imageUrl) {
    return (
      <div
        role="img"
        aria-label={item.alt}
        className={cn(
          "overflow-hidden bg-center",
          fit === "contain" ? "bg-contain bg-no-repeat" : "bg-cover",
          className,
          imageClassName
        )}
        style={{ backgroundImage: `url(${JSON.stringify(item.imageUrl)})` }}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_55%,#dbeafe_100%)]",
        className
      )}
    >
      {index === 0 ? (
        <Building2 className="size-12 text-cyan-700" aria-hidden="true" />
      ) : (
        <ImageIcon className="size-12 text-cyan-700" aria-hidden="true" />
      )}
    </div>
  )
}

function normalizeFilterKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function galleryItemKey(item: GalleryItem, index: number) {
  return `${item.category}-${item.title}-${item.imageUrl ?? index}-${index}`
}
