import { expect, type APIResponse, test } from "@playwright/test"

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001"

test.describe("soft-launch readiness safeguards", () => {
  test("maintenance page is available for controlled launch pauses", async ({ page }) => {
    await page.goto("/maintenance")

    await expect(page.getByRole("heading", { name: /operations are briefly paused/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /check service health/i })).toBeVisible()
  })

  test("launch readiness admin page is protected server-side", async ({ request }) => {
    const response = await request.get("/admin/launch-readiness", { maxRedirects: 0 })

    expect([307, 308]).toContain(response.status())
    expect(response.headers().location).toContain("/login")
  })

  test("launch diagnostics and metrics reject anonymous access safely", async ({ request }) => {
    const responses = await Promise.all([
      request.get(`/api/launch/diagnostics?organizationId=${ORGANIZATION_ID}`),
      request.get(`/api/launch/metrics?organizationId=${ORGANIZATION_ID}`),
    ])

    for (const response of responses) {
      await expectSafeAuthFailure(response)
    }
  })
})

async function expectSafeAuthFailure(response: APIResponse) {
  const body = await response.json()

  expect([401, 403]).toContain(response.status())
  expect(body.success).toBe(false)
  expect(body.error.message).not.toMatch(
    /service_role|stack|postgres|supabase|storage_path|bucket|secret|token/i
  )
}
