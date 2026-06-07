import type { ReactNode } from "react"

import { PublicShell } from "@/components/layout/public-shell"
import { JsonLd } from "@/components/seo/json-ld"
import { createPublicSiteJsonLd } from "@/lib/seo"

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd data={createPublicSiteJsonLd()} />
      <PublicShell>{children}</PublicShell>
    </>
  )
}
