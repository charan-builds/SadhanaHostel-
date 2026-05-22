import { expect, type APIResponse, type Page, test } from "@playwright/test"

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001"
const HOSTEL_ID = "00000000-0000-4000-8000-000000000002"
const USER_ID = "00000000-0000-4000-8000-000000000011"

const runOperationalMutations =
  process.env.E2E_OPERATIONAL_UAT_RUN_MUTATIONS === "true"
const adminCredentials = getCredentials("E2E_ADMIN")

test.describe("soft-launch public experience", () => {
  const publicRoutes = [
    { path: "/", heading: /^sadhana boys hostel$/i },
    { path: "/contact", heading: /contact sadhana boys hostel/i },
    { path: "/rooms", heading: /clear room plans/i },
    { path: "/facilities", heading: /practical facilities/i },
    { path: "/gallery", heading: /hostel spaces and published media/i },
  ]

  for (const route of publicRoutes) {
    test(`${route.path} renders without client runtime errors`, async ({ page }) => {
      const errors = collectRuntimeErrors(page)

      await page.goto(route.path)
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible()

      expect(errors).toEqual([])
    })
  }
})

test.describe("operational route protection", () => {
  const adminRoutes = [
    "/admin/setup",
    "/admin/dashboard",
    "/admin/settings",
    "/admin/settings/staff-access",
    "/admin/finance/payment-security",
    "/admin/gallery",
    "/admin/website",
    "/admin/residents",
    "/admin/residents/verification",
    "/admin/reservations",
    "/admin/vacancy",
  ]

  for (const route of adminRoutes) {
    test(`${route} redirects unauthenticated traffic before rendering`, async ({
      request,
    }) => {
      const response = await request.get(route, { maxRedirects: 0 })

      expect([307, 308]).toContain(response.status())
      expect(response.headers().location).toContain("/login")
    })
  }
})

test.describe("black-box operational abuse resistance", () => {
  test("staff access APIs reject anonymous access with sanitized errors", async ({
    request,
  }) => {
    const responses = await Promise.all([
      request.get(`/api/staff-access/users?organizationId=${ORGANIZATION_ID}`),
      request.post("/api/staff-access/users", {
        data: {
          organizationId: ORGANIZATION_ID,
          hostelIds: [HOSTEL_ID],
          fullName: "Unauthorized QA User",
          email: "unauthorized.staff.qa@example.com",
          phone: "+919999999999",
          role: "finance",
          accessMethod: "invite",
        },
      }),
      request.patch(`/api/staff-access/users/${USER_ID}`, {
        data: {
          organizationId: ORGANIZATION_ID,
          role: "admin",
          status: "active",
        },
      }),
      request.post(`/api/staff-access/users/${USER_ID}/reset-password`, {
        data: {
          organizationId: ORGANIZATION_ID,
        },
      }),
      request.post(`/api/staff-access/users/${USER_ID}/revoke`, {
        data: {
          organizationId: ORGANIZATION_ID,
        },
      }),
    ])

    for (const response of responses) {
      await expectSafeAuthFailure(response)
    }
  })

  test("admin self-service setup APIs are not callable anonymously", async ({
    request,
  }) => {
    const responses = await Promise.all([
      request.post("/api/platform/bootstrap", {
        data: {
          organizationName: "Unauthorized Hostel",
          organizationPhone: "+919999999999",
          organizationEmail: "owner.qa@example.com",
          hostelName: "Unauthorized Hostel Branch",
          hostelCapacity: 70,
        },
      }),
      request.patch("/api/platform/organization", {
        data: {
          organizationId: ORGANIZATION_ID,
          name: "Tampered Organization",
        },
      }),
      request.get(`/api/onboarding/queue?organizationId=${ORGANIZATION_ID}`),
    ])

    for (const response of responses) {
      await expectSafeAuthFailure(response)
    }
  })

  test("gallery upload requires a real image file before DB records are created", async ({
    request,
  }) => {
    const response = await request.post("/api/website/gallery/upload", {
      multipart: {
        organizationId: ORGANIZATION_ID,
        hostelId: HOSTEL_ID,
        title: "Missing file QA",
        altText: "Missing file QA",
        category: "qa",
        status: "draft",
      },
    })
    const body = await response.json()

    expect(response.status()).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.message).toMatch(/file/i)
    expectSanitizedMessage(body.error.message)
  })
})

test.describe("credential-gated operational surfaces", () => {
  test.skip(
    !runOperationalMutations || !adminCredentials,
    "Set E2E_OPERATIONAL_UAT_RUN_MUTATIONS=true plus E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD to run authenticated operational UAT smoke."
  )

  test("admin can reach staff access control center after login", async ({ page }) => {
    await login(page, "/admin/login", adminCredentials!)

    await page.goto("/admin/settings/staff-access")
    await expect(
      page.getByRole("heading", { name: /staff & access/i })
    ).toBeVisible()
    await expect(page.getByText(/invite staff/i)).toBeVisible()
  })

  test("admin can reach operational management surfaces after login", async ({
    page,
  }) => {
    await login(page, "/admin/login", adminCredentials!)

    const routes = [
      { path: "/admin/setup", heading: /hostel setup/i },
      { path: "/admin/finance/payment-security", heading: /payment security/i },
      { path: "/admin/gallery", heading: /gallery/i },
      { path: "/admin/website", heading: /website cms/i },
      { path: "/admin/residents/verification", heading: /verification queue/i },
      { path: "/admin/vacancy", heading: /vacancy/i },
    ]

    for (const route of routes) {
      await page.goto(route.path)
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible()
    }
  })
})

type Credentials = {
  email: string
  password: string
}

function getCredentials(prefix: "E2E_ADMIN"): Credentials | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim()
  const password = process.env[`${prefix}_PASSWORD`]?.trim()

  return email && password ? { email, password } : null
}

async function login(page: Page, path: string, credentials: Credentials) {
  await page.goto(path)
  await page.getByLabel(/email or phone/i).fill(credentials.email)
  await page.getByLabel(/^password$/i).fill(credentials.password)
  await page.getByRole("button", { name: /^sign in$/i }).click()
  await expect(page).toHaveURL(/\/admin/)
}

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
