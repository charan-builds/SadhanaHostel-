import { existsSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import {
  absoluteUrl,
  createFaqJsonLd,
  createPublicPageJsonLd,
  createPublicSiteJsonLd,
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

describe("public SEO metadata routes", () => {
  it("publishes Tirupati and core launch pages with production HTTPS URLs in the sitemap", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "http://localhost:3002",
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "sadhanaboyshostel.in",
      },
      () => {
        const urls = sitemap().map((entry) => entry.url)

        expect(urls).toContain("https://sadhanaboyshostel.in/tirupati-boys-hostel")
        expect(urls).toContain("https://sadhanaboyshostel.in/hostel-near-colleges-tirupati")
        expect(urls).toContain("https://sadhanaboyshostel.in/student-accommodation-tirupati")
        expect(urls).toContain("https://sadhanaboyshostel.in/pulivendula-boys-hostel")
        expect(urls).toContain("https://sadhanaboyshostel.in/student-hostel-pulivendula")
        expect(urls).toContain("https://sadhanaboyshostel.in/employee-hostel-pulivendula")
        expect(urls).toContain("https://sadhanaboyshostel.in/rooms")
        expect(urls).toContain("https://sadhanaboyshostel.in/fees")
        expect(urls).toContain("https://sadhanaboyshostel.in/admissions")
        expect(urls).toContain("https://sadhanaboyshostel.in/privacy")
        expect(urls).not.toContain("https://sadhanaboyshostel.in/hostel-in-pulivendula")
        expect(urls.every((url) => !url.includes("localhost"))).toBe(true)
        expect(urls.every((url) => url.startsWith("https://"))).toBe(true)
        expect(sitemap().flatMap((entry) => entry.images ?? [])).toEqual(
          expect.arrayContaining([
            "https://sadhanaboyshostel.in/images/hostel-exterior-wide.webp",
          ])
        )
      }
    )
  })

  it("uses stable meaningful lastmod values instead of request time in the sitemap", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "https://sadhanaboyshostel.in",
        NEXT_PUBLIC_LAUNCH_MODE: "production",
      },
      () => {
        const firstRun = sitemap()
        const secondRun = sitemap()
        const lastModifiedValues = firstRun.map((entry) =>
          entry.lastModified instanceof Date
            ? entry.lastModified.toISOString()
            : entry.lastModified
        )

        expect(new Set(lastModifiedValues)).toEqual(
          new Set(["2026-06-05T00:00:00.000Z"])
        )
        expect(secondRun.map((entry) => entry.lastModified)).toEqual(
          firstRun.map((entry) => entry.lastModified)
        )
      }
    )
  })

  it("allows public Tirupati launch pages and blocks private areas in production robots", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "https://sadhanaboyshostel.in",
        NEXT_PUBLIC_LAUNCH_MODE: "production",
      },
      () => {
        const output = robots()
        const rules = output.rules as {
          allow?: string[]
          disallow?: string[]
        }

        expect(output.sitemap).toBe("https://sadhanaboyshostel.in/sitemap.xml")
        expect(rules.allow).toEqual(
          expect.arrayContaining([
            "/tirupati-boys-hostel",
            "/hostel-near-colleges-tirupati",
            "/student-accommodation-tirupati",
            "/pulivendula-boys-hostel",
            "/student-hostel-pulivendula",
            "/employee-hostel-pulivendula",
            "/rooms",
            "/fees",
            "/admissions",
            "/privacy",
          ])
        )
        expect(rules.disallow).toEqual(expect.arrayContaining(["/admin/", "/resident/", "/api/"]))
      }
    )
  })

  it("fails closed with a full disallow robots file outside production indexing state", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "http://localhost:3002",
      },
      () => {
        const output = robots()

        expect(output.rules).toEqual({
          userAgent: "*",
          disallow: "/",
        })
        expect(output.sitemap).toBe("http://localhost:3002/sitemap.xml")
      }
    )
  })

  it("keeps all sitemap image references backed by public files", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "https://sadhanaboyshostel.in",
        NEXT_PUBLIC_LAUNCH_MODE: "production",
      },
      () => {
        const imageUrls = sitemap().flatMap((entry) => entry.images ?? [])

        for (const imageUrl of imageUrls) {
          const url = new URL(imageUrl)
          const filePath = path.join(process.cwd(), "public", url.pathname)

          expect(existsSync(filePath), imageUrl).toBe(true)
        }
      }
    )
  })

  it("upgrades configured production HTTP origins to HTTPS canonical URLs", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "http://sadhanaboyshostel.in",
        NEXT_PUBLIC_LAUNCH_MODE: "production",
      },
      () => {
        expect(absoluteUrl("/fees")).toBe("https://sadhanaboyshostel.in/fees")
        expect(sitemap().every((entry) => entry.url.startsWith("https://"))).toBe(true)
      }
    )
  })

  it("emits valid launch schema coverage for LocalBusiness, Hostel, Organization, FAQ, and Breadcrumb", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "https://sadhanaboyshostel.in",
        NEXT_PUBLIC_LAUNCH_MODE: "production",
      },
      () => {
        const siteSchema = createPublicSiteJsonLd()
        const pageSchema = createPublicPageJsonLd({
          name: "Boys hostel in Tirupati",
          description: "Tirupati boys hostel landing page.",
          path: "/tirupati-boys-hostel",
        })
        const faqSchema = createFaqJsonLd([
          {
            question: "What is the hostel fee?",
            answer: "Student hostel rooms start from published monthly pricing.",
          },
        ])
        const siteGraph = siteSchema["@graph"]
        const pageGraph = pageSchema["@graph"]
        const business = siteGraph.find((node) => {
          const type = node["@type"]

          return Array.isArray(type) && type.includes("LocalBusiness")
        })

        expect(business).toBeTruthy()
        expect(business?.["@type"]).toEqual(
          expect.arrayContaining(["LocalBusiness", "Hostel"])
        )
        expect(siteGraph.some((node) => node["@type"] === "Organization")).toBe(true)
        expect(pageGraph.some((node) => node["@type"] === "BreadcrumbList")).toBe(true)
        expect(pageGraph.every((node) => JSON.stringify(node).includes("https://sadhanaboyshostel.in"))).toBe(true)
        expect(faqSchema["@type"]).toBe("FAQPage")
        expect(faqSchema.mainEntity).toHaveLength(1)
      }
    )
  })
})
