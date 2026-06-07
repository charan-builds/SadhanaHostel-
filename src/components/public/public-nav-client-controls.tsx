"use client"

import { useState, type ComponentType } from "react"
import dynamic from "next/dynamic"
import { Menu } from "lucide-react"

const LanguageSwitcher = dynamic(
  () =>
    import("@/components/public/language-switcher").then(
      (mod) => mod.LanguageSwitcher
    ),
  { ssr: false }
)

type MobileMenuComponent = ComponentType<{
  logoUrl?: string | null
  defaultOpen?: boolean
}>

export function PublicNavClientControls({
  logoUrl,
}: {
  logoUrl?: string | null
}) {
  const [MobileMenu, setMobileMenu] = useState<MobileMenuComponent | null>(null)
  const [isLoadingMobileMenu, setIsLoadingMobileMenu] = useState(false)

  async function handleOpenMobileMenu() {
    if (MobileMenu || isLoadingMobileMenu) {
      return
    }

    setIsLoadingMobileMenu(true)
    try {
      const mod = await import("@/components/public/public-mobile-menu")
      setMobileMenu(() => mod.PublicMobileMenu)
    } finally {
      setIsLoadingMobileMenu(false)
    }
  }

  return (
    <>
      <LanguageSwitcher className="hidden xl:flex" />
      <LanguageSwitcher compact className="lg:hidden" />
      {MobileMenu ? (
        <MobileMenu logoUrl={logoUrl} defaultOpen />
      ) : (
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-lg border border-border/80 bg-background/80 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60 lg:hidden"
          aria-label="Open public navigation menu"
          disabled={isLoadingMobileMenu}
          onClick={handleOpenMobileMenu}
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      )}
    </>
  )
}
