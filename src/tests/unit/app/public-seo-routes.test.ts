import { describe, expect, it } from "vitest"

import robots from "@/app/robots"
import sitemap from "@/app/sitemap"

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
  it("publishes Pulivendula landing pages with production absolute URLs in the sitemap", () => {
    withSeoEnv(
      {
        NEXT_PUBLIC_APP_URL: "http://localhost:3002",
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "sadhanaboyshostel.in",
      },
      () => {
        const urls = sitemap().map((entry) => entry.url)

        expect(urls).toContain("https://sadhanaboyshostel.in/pulivendula-boys-hostel")
        expect(urls).toContain("https://sadhanaboyshostel.in/student-hostel-pulivendula")
        expect(urls).toContain("https://sadhanaboyshostel.in/employee-hostel-pulivendula")
        expect(urls).not.toContain("https://sadhanaboyshostel.in/hostel-in-pulivendula")
        expect(urls.every((url) => !url.includes("localhost"))).toBe(true)
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
          new Set(["2026-06-02T00:00:00.000Z"])
        )
        expect(secondRun.map((entry) => entry.lastModified)).toEqual(
          firstRun.map((entry) => entry.lastModified)
        )
      }
    )
  })

  it("allows public Pulivendula pages and blocks private areas in production robots", () => {
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
            "/pulivendula-boys-hostel",
            "/student-hostel-pulivendula",
            "/employee-hostel-pulivendula",
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
})
