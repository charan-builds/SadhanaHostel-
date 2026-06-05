import { describe, expect, it } from "vitest"

import {
  absoluteUrl,
  createLocalLandingPagesItemListJsonLd,
  createPublicMetadata,
  createPublicPageJsonLd,
  createPublicSiteJsonLd,
  getSiteUrl,
  isIndexableProductionUrl,
  noIndexMetadata,
} from "@/lib/seo"

const SEO_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_LAUNCH_MODE",
  "LAUNCH_MODE",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const

type SeoEnvSnapshot = Partial<Record<(typeof SEO_ENV_KEYS)[number], string>>

function captureSeoEnv(): SeoEnvSnapshot {
  return Object.fromEntries(
    SEO_ENV_KEYS.map((key) => [key, process.env[key]])
  ) as SeoEnvSnapshot
}

function restoreSeoEnv(snapshot: SeoEnvSnapshot) {
  for (const key of SEO_ENV_KEYS) {
    const value = snapshot[key]

    if (value === undefined) {
      delete process.env[key]
      continue
    }

    process.env[key] = value
  }
}

function withSeoEnv(env: SeoEnvSnapshot, callback: () => void) {
  const snapshot = captureSeoEnv()

  for (const key of SEO_ENV_KEYS) {
    delete process.env[key]
  }

  Object.assign(process.env, env)

  try {
    callback()
  } finally {
    restoreSeoEnv(snapshot)
  }
}

describe("SEO URL helpers", () => {
  it("keeps private app areas out of search indexes and snippets", () => {
    expect(noIndexMetadata.robots).toEqual({
      index: false,
      follow: false,
      noarchive: true,
      noimageindex: true,
      nocache: true,
      nosnippet: true,
      notranslate: true,
      googleBot: {
        index: false,
        follow: false,
        noarchive: true,
        noimageindex: true,
        nocache: true,
        nosnippet: true,
        notranslate: true,
      },
    })
  })

  it("uses the configured production app URL for canonical URLs", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "https://sadhanaboyshostel.in/some-path",
        NEXT_PUBLIC_LAUNCH_MODE: "production",
      },
      () => {
        expect(getSiteUrl()).toBe("https://sadhanaboyshostel.in")
        expect(absoluteUrl("/rooms")).toBe("https://sadhanaboyshostel.in/rooms")
        expect(isIndexableProductionUrl()).toBe(true)
      }
    )
  })

  it("uses the Vercel production domain when the configured app URL is local", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "http://localhost:3002",
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "sadhanaboyshostel.in",
      },
      () => {
        expect(getSiteUrl()).toBe("https://sadhanaboyshostel.in")
        expect(absoluteUrl("/sitemap.xml")).toBe("https://sadhanaboyshostel.in/sitemap.xml")
        expect(isIndexableProductionUrl()).toBe(true)
      }
    )
  })

  it("keeps local and preview URLs out of the indexable production state", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "http://localhost:3002",
      },
      () => {
        expect(getSiteUrl()).toBe("http://localhost:3002")
        expect(isIndexableProductionUrl()).toBe(false)
      }
    )
  })

  it("fails closed when production SEO URLs cannot resolve a real public domain", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "http://localhost:3002",
        NEXT_PUBLIC_LAUNCH_MODE: "production",
      },
      () => {
        expect(() => getSiteUrl()).toThrow(
          "Cannot build public SEO URLs: configure NEXT_PUBLIC_APP_URL"
        )
        expect(isIndexableProductionUrl()).toBe(false)
      }
    )
  })

  it("publishes safe local business facts for Pulivendula hostel search", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "https://sadhanaboyshostel.in",
        NEXT_PUBLIC_LAUNCH_MODE: "production",
      },
      () => {
        const graph = createPublicSiteJsonLd()["@graph"]
        const localBusiness = graph.find((item) => item["@id"].endsWith("#local-business"))

        expect(localBusiness).toEqual(
          expect.objectContaining({
            name: "Sadhana Boys Hostel",
            telephone: "+917013762904",
            currenciesAccepted: "INR",
            paymentAccepted: ["Cash", "UPI"],
            knowsLanguage: ["en-IN", "te-IN"],
            hasMap: expect.stringContaining("google.com/maps"),
          })
        )
        expect(localBusiness?.["@type"]).toEqual(
          expect.arrayContaining(["LocalBusiness", "LodgingBusiness", "Hostel"])
        )
        expect(localBusiness?.potentialAction).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              "@type": "CommunicateAction",
              name: "Ask Sadhana Boys Hostel joining details",
              target: "https://sadhanaboyshostel.in/contact",
            }),
          ])
        )
      }
    )
  })

  it("connects every public WebPage schema back to the same local business entity", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "https://sadhanaboyshostel.in",
        NEXT_PUBLIC_LAUNCH_MODE: "production",
      },
      () => {
        const pageJsonLd = createPublicPageJsonLd({
          name: "Boys hostel in Pulivendula",
          description: "Sadhana Boys Hostel Pulivendula local landing page.",
          path: "/pulivendula-boys-hostel",
        })
        const graph = pageJsonLd["@graph"]
        const webPage = graph.find((item) => item["@id"].endsWith("#webpage"))
        const businessReference = {
          "@id": "https://sadhanaboyshostel.in/#local-business",
        }

        expect(webPage).toEqual(
          expect.objectContaining({
            "@type": "WebPage",
            "@id": "https://sadhanaboyshostel.in/pulivendula-boys-hostel#webpage",
            about: businessReference,
            publisher: businessReference,
            provider: businessReference,
            isPartOf: {
              "@id": "https://sadhanaboyshostel.in/#website",
            },
          })
        )
      }
    )
  })

  it("keeps the generic hostel in Pulivendula landing page in the internal SEO list", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "https://sadhanaboyshostel.in",
        NEXT_PUBLIC_LAUNCH_MODE: "production",
      },
      () => {
        const itemList = createLocalLandingPagesItemListJsonLd()

        expect(itemList.itemListElement).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: "Hostel in Pulivendula",
              url: "https://sadhanaboyshostel.in/pulivendula-boys-hostel",
            }),
          ])
        )
      }
    )
  })

  it("adds regional hreflang alternates to public page metadata", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "https://sadhanaboyshostel.in",
        NEXT_PUBLIC_LAUNCH_MODE: "production",
      },
      () => {
        const metadata = createPublicMetadata({
          title: "Hostel in Pulivendula",
          description: "Sadhana Boys Hostel Pulivendula",
          path: "/pulivendula-boys-hostel",
        })

        expect(metadata.alternates).toEqual(
          expect.objectContaining({
            canonical: "/pulivendula-boys-hostel",
            languages: {
              "en-IN": "/pulivendula-boys-hostel",
              "x-default": "/pulivendula-boys-hostel",
            },
          })
        )
      }
    )
  })
})
