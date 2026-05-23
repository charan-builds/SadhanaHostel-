import { expect, type APIResponse, type Page, test } from "@playwright/test"

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001"

test.describe("operational recovery and automation surfaces", () => {
  test("public support center provides recovery guidance", async ({ page }) => {
    const errors = collectRuntimeErrors(page)

    await page.goto("/support")
    await expect(page.getByRole("heading", { name: /support center/i })).toBeVisible()
    await expect(page.getByText(/expired invite/i)).toBeVisible()
    await expect(page.getByText(/rejected payment/i)).toBeVisible()
    await expect(page.getByRole("link", { name: /whatsapp support/i })).toBeVisible()

    expect(errors).toEqual([])
  })

  test("resident support is protected but allowed as onboarding recovery route", async ({
    request,
  }) => {
    const response = await request.get("/resident/support", { maxRedirects: 0 })

    expect([307, 308]).toContain(response.status())
    expect(response.headers().location).toContain("/login")
  })

  test("automation and consistency APIs reject anonymous access safely", async ({
    request,
  }) => {
    const responses = await Promise.all([
      request.get(`/api/operations/automation?organizationId=${ORGANIZATION_ID}`),
      request.post("/api/operations/automation/run", {
        data: {
          organizationId: ORGANIZATION_ID,
          name: "consistency_validation",
          dryRun: true,
          payload: {},
        },
      }),
      request.get(`/api/operations/consistency/report?organizationId=${ORGANIZATION_ID}`),
      request.post("/api/operations/consistency/repair", {
        data: {
          organizationId: ORGANIZATION_ID,
          action: "run_consistency_scan",
          dryRun: true,
        },
      }),
      request.get(`/api/support/alerts?organizationId=${ORGANIZATION_ID}`),
    ])

    for (const response of responses) {
      await expectSafeAuthFailure(response)
    }
  })

  test("malformed support requests return operational validation errors", async ({
    request,
  }) => {
    const response = await request.post("/api/support/requests", {
      data: {
        category: "payment",
        subject: "Pay",
        description: "short",
      },
    })
    const body = await response.json()

    expect([400, 401, 422]).toContain(response.status())
    expect(body.success).toBe(false)
    expectSanitizedMessage(body.error.message)
  })
})

async function expectSafeAuthFailure(response: APIResponse) {
  const body = await response.json()

  expect([401, 403]).toContain(response.status())
  expect(body.success).toBe(false)
  expectSanitizedMessage(body.error.message)
}

function expectSanitizedMessage(message: string) {
  expect(message).not.toMatch(
    /service_role|stack|postgres|supabase|storage_path|bucket|secret|token/i
  )
}

function collectRuntimeErrors(page: Page) {
  const errors: string[] = []

  page.on("pageerror", (error) => {
    errors.push(error.message)
  })
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text())
    }
  })

  return errors
}
