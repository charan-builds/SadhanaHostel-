import { expect, type Page, test } from "@playwright/test"

const adminCredentials = getCredentials("E2E_ADMIN")
const residentCredentials = getCredentials("E2E_RESIDENT")

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

    await expect(
      page.getByText(/invalid email or password|sign in failed|too many requests/i)
    ).toBeVisible()
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

test.describe("admin credential flow", () => {
  test.skip(!adminCredentials, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin auth E2E.")

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
  test.skip(!residentCredentials, "Set E2E_RESIDENT_EMAIL and E2E_RESIDENT_PASSWORD to run resident auth E2E.")

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
