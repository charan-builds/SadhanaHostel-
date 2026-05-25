import { expect, type Page, test } from "@playwright/test"

const adminCredentials = getCredentials("E2E_ADMIN")
const residentCredentials = getCredentials("E2E_RESIDENT")
const runCredentialFlows = process.env.E2E_AUTH_RUN_REAL_FLOWS === "true"
const activationInvite = getActivationInvite()
const runActivationFlow = process.env.E2E_AUTH_RUN_ACTIVATION_FLOW === "true"

test.describe("public authentication pages", () => {
  test("login entry pages render without runtime errors", async ({ page }) => {
    const errors = collectRuntimeErrors(page)

    await page.goto("/login")
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
    await expect(page.getByLabel(/email or phone/i)).toBeVisible()
    await expect(page.getByLabel(/^password$/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /show password/i })).toBeVisible()

    await page.goto("/resident/login")
    await expect(page.getByRole("heading", { name: /resident portal/i })).toBeVisible()

    await page.goto("/admin/login")
    await expect(page.getByRole("heading", { name: /admin portal/i })).toBeVisible()

    await page.goto("/forgot-password")
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible()

    await page.goto("/activate")
    await expect(page.getByRole("heading", { name: /activate resident access/i })).toBeVisible()
    await expect(page.getByLabel(/invite code/i)).toBeVisible()

    expect(errors).toEqual([])
  })

  test("public navbar exposes resident and admin login paths", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("button", { name: /^login/i }).click()
    await expect(page.getByRole("menuitem", { name: /resident portal/i })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: /admin portal/i })).toBeVisible()
  })

  test("invalid credentials produce a safe error state", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email or phone/i).fill("invalid.auth.qa@example.com")
    await page.getByLabel(/^password$/i).fill("DefinitelyWrong123!")
    await page.getByRole("button", { name: /^sign in$/i }).click()

    await expect(page.getByText(/invalid phone\/email or password/i)).toBeVisible()
  })
})

test.describe("server-side auth guards", () => {
  const protectedRoutes = [
    "/admin",
    "/admin/dashboard",
    "/admin/residents",
    "/admin/payments",
    "/admin/rooms",
    "/resident",
    "/resident/dashboard",
    "/resident/payments",
    "/resident/leave",
  ]

  for (const route of protectedRoutes) {
    test(`unauthenticated request to ${route} redirects before render`, async ({
      request,
    }) => {
      const response = await request.get(route, { maxRedirects: 0 })

      expect([307, 308]).toContain(response.status())
      expect(response.headers().location).toContain("/login")
    })
  }

  test("browser navigation to a protected route lands on login with next param", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard")

    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fdashboard/)
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
  })
})

test.describe("resident invite activation", () => {
  test("invalid activation links show resident-safe recovery guidance", async ({ page }) => {
    await page.goto(
      `/activate?token=${encodeURIComponent(
        "v1.invalidinvalidinvalidinvalidinvalidinvalid.invalidinvalidinvalidinvalidinvalid"
      )}`
    )

    await expect(page.getByText(/invite unavailable/i)).toBeVisible()
    await expect(page.getByRole("link", { name: /get invite help/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /enter invite code/i })).toBeVisible()
  })

  test("resident can activate a fresh invite and land in onboarding", async ({ page }) => {
    test.skip(
      !runActivationFlow || !activationInvite,
      "Set E2E_AUTH_RUN_ACTIVATION_FLOW=true plus E2E_RESIDENT_INVITE_TOKEN/E2E_RESIDENT_ACTIVATION_PASSWORD with a fresh one-time invite."
    )

    await page.goto(`/activate?token=${encodeURIComponent(activationInvite!.token)}`)

    await expect(page.getByText(/invite verified/i)).toBeVisible()
    await page.getByLabel(/create password/i).fill(activationInvite!.password)
    await page.getByLabel(/confirm password/i).fill(activationInvite!.password)
    await page.getByRole("button", { name: /activate resident account/i }).click()

    await expect(page).toHaveURL(/\/resident\/onboarding|\/resident\/dashboard/)
  })
})

test.describe("admin credential flow", () => {
  test.skip(
    !runCredentialFlows || !adminCredentials,
    "Set E2E_AUTH_RUN_REAL_FLOWS=true plus E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD to run admin auth E2E."
  )

  test("admin can login, persist session, and logout", async ({ page }) => {
    await login(page, "/admin/login", adminCredentials!)

    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await page.reload()
    await expect(page).toHaveURL(/\/admin\/dashboard/)

    const session = await getSession(page)
    expect(session.authenticated).toBe(true)
    expect(session.roles).toEqual(expect.arrayContaining(["admin"]))

    await page.getByRole("button", { name: /open admin profile menu/i }).click()
    await page.getByRole("menuitem", { name: /logout/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test("admin is blocked from resident-only workspace unless explicitly assigned", async ({
    page,
  }) => {
    await login(page, "/admin/login", adminCredentials!)
    await page.goto("/resident/dashboard")

    await expect(page).toHaveURL(/\/unauthorized|\/resident\/dashboard/)
  })
})

test.describe("resident credential flow", () => {
  test.skip(
    !runCredentialFlows || !residentCredentials,
    "Set E2E_AUTH_RUN_REAL_FLOWS=true plus E2E_RESIDENT_EMAIL/E2E_RESIDENT_PASSWORD to run resident auth E2E."
  )

  test("resident can login, persist session, and logout", async ({ page }) => {
    await login(page, "/resident/login", residentCredentials!)

    await expect(page).toHaveURL(/\/resident\/dashboard/)
    await page.reload()
    await expect(page).toHaveURL(/\/resident\/dashboard/)

    const session = await getSession(page)
    expect(session.authenticated).toBe(true)
    expect(session.roles).toEqual(expect.arrayContaining(["resident"]))

    await page.getByRole("button", { name: /logout/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test("resident cannot access admin workspace", async ({ page }) => {
    await login(page, "/resident/login", residentCredentials!)
    await page.goto("/admin/dashboard")

    await expect(page).toHaveURL(/\/unauthorized/)
  })

  test("resident credentials are rejected by admin login UX", async ({ page }) => {
    await page.goto("/admin/login")
    await page.getByLabel(/email or phone/i).fill(residentCredentials!.email)
    await page.getByLabel(/^password$/i).fill(residentCredentials!.password)
    await page.getByRole("button", { name: /^sign in$/i }).click()

    await expect(page.getByText(/does not have admin portal access/i)).toBeVisible()
  })

  test("resident payment page exposes direct UPI app launch actions", async ({ page }) => {
    await login(page, "/resident/login", residentCredentials!)
    await page.goto("/resident/payments")

    await expect(page.getByRole("heading", { name: /^payments$/i })).toBeVisible()

    const phonePeLink = page.getByRole("link", { name: /phonepe/i })
    test.skip(
      (await phonePeLink.count()) === 0,
      "Resident has no active UPI payment account configured in this environment."
    )

    await expect(phonePeLink).toBeVisible()
    await expect(page.getByRole("link", { name: /google pay/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /paytm/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /bhim/i })).toBeVisible()

    const href = await phonePeLink.getAttribute("href")
    expect(href).toContain("upi://pay?")
    expect(href).toContain("pa=")
    expect(href).toContain("am=")
    expect(href).toContain("tn=")
  })
})

type Credentials = {
  email: string
  password: string
}

function getCredentials(prefix: "E2E_ADMIN" | "E2E_RESIDENT"): Credentials | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim()
  const password = process.env[`${prefix}_PASSWORD`]?.trim()

  return email && password ? { email, password } : null
}

function getActivationInvite(): { token: string; password: string } | null {
  const token = process.env.E2E_RESIDENT_INVITE_TOKEN?.trim()
  const password = process.env.E2E_RESIDENT_ACTIVATION_PASSWORD?.trim()

  return token && password ? { token, password } : null
}

async function login(page: Page, path: string, credentials: Credentials) {
  await page.goto(path)
  await page.getByLabel(/email or phone/i).fill(credentials.email)
  await page.getByLabel(/^password$/i).fill(credentials.password)
  await page.getByRole("button", { name: /^sign in$/i }).click()
}

async function getSession(page: Page) {
  const response = await page.request.get("/api/auth/session")
  const body = await response.json()

  return body.data as {
    authenticated: boolean
    roles: string[]
  }
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
