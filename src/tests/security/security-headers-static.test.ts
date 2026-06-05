import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const config = readFileSync("next.config.ts", "utf8")

describe("production security headers", () => {
  it("declares the required browser security headers", () => {
    expect(config).toMatch(/Content-Security-Policy/)
    expect(config).toMatch(/Strict-Transport-Security/)
    expect(config).toMatch(/X-Content-Type-Options/)
    expect(config).toMatch(/Referrer-Policy/)
    expect(config).toMatch(/Permissions-Policy/)
  })

  it("locks framing through CSP frame-ancestors", () => {
    expect(config).toMatch(/frame-ancestors 'none'/)
  })

  it("allows only exact external frame/script domains required by public integrations", () => {
    expect(config).toMatch(
      /frame-src 'self' https:\/\/www\.google\.com https:\/\/maps\.google\.com https:\/\/translate\.google\.com/
    )
    expect(config).toMatch(
      /"script-src 'self' 'unsafe-inline'"/
    )
    expect(config).toMatch(/https:\/\/www\.googletagmanager\.com/)
    expect(config).toMatch(/https:\/\/translate\.google\.com/)
    expect(config).toMatch(/https:\/\/translate\.googleapis\.com/)
    expect(config).toMatch(/https:\/\/translate-pa\.googleapis\.com/)
    expect(config).toMatch(/style-src 'self' 'unsafe-inline' https:\/\/www\.gstatic\.com/)
  })

  it("keeps unsafe-eval limited to development builds for React HMR diagnostics", () => {
    expect(config).toMatch(/process\.env\.NODE_ENV === "development"/)
    expect(config).toMatch(/\.\.\.\(isDevelopment \? \["'unsafe-eval'"\] : \[\]\)/)
  })

  it("allows blob workers without permitting external worker origins", () => {
    expect(config).toMatch(/worker-src 'self' blob:/)
  })

  it("keeps CSP connect-src on HTTPS plus first-party realtime endpoints", () => {
    expect(config).toMatch(/connect-src 'self'/)
    expect(config).toMatch(/supabase\.co/)
    expect(config).toMatch(/wss:\/\/\*\.supabase\.co/)
    expect(config).toMatch(/https:/)
  })
})
