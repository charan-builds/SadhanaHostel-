import "server-only"

import { revalidatePath, revalidateTag } from "next/cache"

import { PUBLIC_CMS_CACHE_TAG } from "@/lib/cms/public-cms"

const publicCmsPaths = [
  "/",
  "/about",
  "/rooms",
  "/facilities",
  "/gallery",
  "/contact",
  "/terms",
  "/pulivendula-boys-hostel",
  "/student-hostel-pulivendula",
  "/employee-hostel-pulivendula",
  "/login",
  "/admin/login",
  "/resident/login",
  "/resident/reset-password",
] as const

export function revalidatePublicCmsContent() {
  revalidateTag(PUBLIC_CMS_CACHE_TAG, { expire: 0 })

  for (const path of publicCmsPaths) {
    revalidatePath(path)
  }
}
