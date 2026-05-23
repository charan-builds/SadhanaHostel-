import { expect, type APIResponse, test } from "@playwright/test"

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001"

test.describe("owner analytics surfaces", () => {
  test("owner dashboard is protected server-side", async ({ request }) => {
    const response = await request.get("/admin/owner-dashboard", { maxRedirects: 0 })

    expect([307, 308]).toContain(response.status())
    expect(response.headers().location).toContain("/login")
  })

  test("owner analytics APIs reject anonymous access safely", async ({ request }) => {
    const responses = await Promise.all([
      request.get(`/api/v1/analytics/owner?organizationId=${ORGANIZATION_ID}`),
      request.get(
        `/api/v1/analytics/owner/export?organizationId=${ORGANIZATION_ID}&format=csv`
      ),
      request.get(
        `/api/v1/analytics/owner/export?organizationId=${ORGANIZATION_ID}&format=pdf`
      ),
    ])

    for (const response of responses) {
      await expectSafeAuthFailure(response)
    }
  })
})

async function expectSafeAuthFailure(response: APIResponse) {
  const contentType = response.headers()["content-type"] ?? ""

  expect([401, 403]).toContain(response.status())

  if (!contentType.includes("application/json")) {
    return
  }

  const body = await response.json()
  expect(body.success).toBe(false)
  expect(body.error.message).not.toMatch(
    /service_role|stack|postgres|supabase|storage_path|bucket|secret|token/i
  )
}
