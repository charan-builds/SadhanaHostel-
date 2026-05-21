import { expect, test } from "@playwright/test"

test("live health endpoint responds", async ({ request }) => {
  const response = await request.get("/api/health/live")
  const body = await response.json()

  expect(response.status()).toBe(200)
  expect(body.success).toBe(true)
  expect(body.data.status).toBe("ok")
})

test("ready health endpoint returns deployment-safe JSON", async ({ request }) => {
  const response = await request.get("/api/health/ready")
  const body = await response.json()

  expect([200, 503]).toContain(response.status())
  expect(typeof body.success).toBe("boolean")
  expect(body.data).toHaveProperty("checks")
})

test("admin routes redirect unauthenticated requests before rendering", async ({
  request,
}) => {
  const response = await request.get("/admin/dashboard", { maxRedirects: 0 })

  expect([307, 308]).toContain(response.status())
  expect(response.headers().location).toContain("/login")
})

test("resident routes redirect unauthenticated requests before rendering", async ({
  request,
}) => {
  const response = await request.get("/resident/dashboard", { maxRedirects: 0 })

  expect([307, 308]).toContain(response.status())
  expect(response.headers().location).toContain("/login")
})
