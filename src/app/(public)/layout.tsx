import type { ReactNode } from "react"

import { PublicShell } from "@/components/layout/public-shell"
import { SessionProviders } from "@/components/providers/app-providers"
import { JsonLd } from "@/components/seo/json-ld"
import { createPublicSiteJsonLd } from "@/lib/seo"

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProviders loadSessionOnMount={false}>
      <JsonLd data={createPublicSiteJsonLd()} />
      <PublicShell>{children}</PublicShell>
    </SessionProviders>
  )
}
