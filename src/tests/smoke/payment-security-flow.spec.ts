import { expect, test } from "@playwright/test"

const runFinanceMutationFlows =
  process.env.E2E_PAYMENT_SECURITY_RUN_MUTATIONS === "true"
const adminEmail = process.env.E2E_ADMIN_EMAIL?.trim()
const adminPassword = process.env.E2E_ADMIN_PASSWORD?.trim()

test.describe("payment security finance console", () => {
  test.skip(
    !runFinanceMutationFlows || !adminEmail || !adminPassword,
    "Set E2E_PAYMENT_SECURITY_RUN_MUTATIONS=true and E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD against staging to run finance config mutation E2E."
  )

  test("admin can update UPI configuration and run validation", async ({ page }) => {
    await page.goto("/admin/login")
    await page.getByLabel(/email or phone/i).fill(adminEmail!)
    await page.getByLabel(/^password$/i).fill(adminPassword!)
    await page.getByRole("button", { name: /^sign in$/i }).click()

    await page.goto("/admin/finance/payment-security")
    await expect(page.getByRole("heading", { name: /payment security/i })).toBeVisible()

    await page.getByLabel(/account holder name/i).fill("Sadhana Boys Hostel")
    await page.getByLabel(/^upi id$/i).fill(`sadhanahostel.qa.${Date.now()}@ibl`)
    await page.getByLabel(/bank name/i).fill("HDFC Bank")
    await page.getByRole("button", { name: /^test$/i }).click()
    await expect(page.getByText(/configuration/i)).toBeVisible()

    await page.getByRole("button", { name: /^save$/i }).click()
    await expect(page.getByText(/payment.*saved|rotated safely/i)).toBeVisible()
  })

  test("admin can replace QR, refresh, and keep the signed preview visible", async ({
    browser,
    page,
  }) => {
    await page.goto("/admin/login")
    await page.getByLabel(/email or phone/i).fill(adminEmail!)
    await page.getByLabel(/^password$/i).fill(adminPassword!)
    await page.getByRole("button", { name: /^sign in$/i }).click()

    await page.goto("/admin/finance/payment-security")
    await expect(page.getByRole("heading", { name: /payment security/i })).toBeVisible()
    await expect(page.getByLabel(/replace qr image/i)).toBeVisible()

    await page.getByLabel(/replace qr image/i).setInputFiles({
      name: `payment-qr-${Date.now()}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      ),
    })
    await expect(page.getByAltText(/selected payment qr preview/i)).toBeVisible()
    await expect(page.getByText(/selected locally/i)).toBeVisible()
    await expect(page.getByText(/selected, not live/i)).toBeVisible()

    await page.getByRole("button", { name: /upload.*save/i }).click()
    await expect(page.getByText(/payment.*saved|rotated safely/i)).toBeVisible()
    await expect(page.getByAltText(/current active payment qr/i)).toBeVisible()

    await page.reload()
    await expect(page.getByAltText(/current active payment qr/i)).toBeVisible()

    const secondAdmin = await browser.newPage()
    await secondAdmin.goto("/admin/login")
    await secondAdmin.getByLabel(/email or phone/i).fill(adminEmail!)
    await secondAdmin.getByLabel(/^password$/i).fill(adminPassword!)
    await secondAdmin.getByRole("button", { name: /^sign in$/i }).click()
    await secondAdmin.goto("/admin/finance/payment-security")
    await expect(secondAdmin.getByAltText(/current active payment qr/i)).toBeVisible()
    await secondAdmin.close()

    const response = await page.request.get("/api/auth/session")
    expect(response.ok()).toBe(true)
  })
})
