import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(path: string) {
  return readFileSync(join(root, path), "utf8")
}

describe("lead form and portal stability fixes", () => {
  it("keeps the public lead form to the three required conversion fields", () => {
    const form = source("src/components/forms/contact-inquiry-form.tsx")

    expect(form).toContain("Full Name")
    expect(form).toContain("Mobile Number")
    expect(form).toContain("WhatsApp Number")
    expect(form).toContain("h-14 rounded-xl text-base")
    expect(form).toContain("Request callback")
    expect(form).not.toContain("Resident type interest")
    expect(form).not.toContain("Desired joining date")
    expect(form).not.toContain("Expected stay duration")
    expect(form).not.toContain("Parent contact")
    expect(form).not.toContain("Optional email address")
  })

  it("exposes lead form content and image controls in admin website settings", () => {
    const adminWebsite = source("src/components/admin/website/admin-website-client.tsx")

    expect(adminWebsite).toContain("Lead Form Section")
    expect(adminWebsite).toContain("Lead Form Title")
    expect(adminWebsite).toContain("Lead Form Subtitle")
    expect(adminWebsite).toContain("Lead Form Description")
    expect(adminWebsite).toContain("CTA Button Text")
    expect(adminWebsite).toContain("Upload Lead Section Image")
    expect(adminWebsite).toContain("Replace Existing Image")
    expect(adminWebsite).toContain("lead_form_image_url")
    expect(adminWebsite).toContain("category: \"lead-form\"")
  })

  it("renders lead form public content from CMS instead of a hardcoded image-only section", () => {
    const cms = source("src/lib/cms/public-cms.ts")
    const page = source("src/app/(public)/page.tsx")
    const inquirySection = source("src/components/public/inquiry-section.tsx")

    expect(cms).toContain("leadForm: LeadFormContent")
    expect(cms).toContain("lead_form_title")
    expect(cms).toContain("lead_form_image_url")
    expect(page).toContain("<InquirySection leadForm={cms.leadForm} />")
    expect(inquirySection).toContain("leadForm?.imageUrl")
    expect(inquirySection).toContain("<ContactInquiryForm content={leadForm} />")
  })

  it("keeps admin and resident route shells guarded by loading, error, and not-found UI", () => {
    const requiredFiles = [
      "src/app/(admin)/loading.tsx",
      "src/app/(admin)/error.tsx",
      "src/app/(admin)/not-found.tsx",
      "src/app/(resident)/loading.tsx",
      "src/app/(resident)/error.tsx",
      "src/app/(resident)/not-found.tsx",
      "src/app/(admin)/admin/dashboard/page.tsx",
      "src/app/(resident)/resident/dashboard/page.tsx",
    ]

    for (const file of requiredFiles) {
      expect(existsSync(join(root, file)), `${file} should exist`).toBe(true)
    }
  })

  it("keeps primary admin and resident navigation links backed by pages", () => {
    const routeFiles = [
      "src/app/(admin)/admin/dashboard/page.tsx",
      "src/app/(admin)/admin/owner-dashboard/page.tsx",
      "src/app/(admin)/admin/operations/page.tsx",
      "src/app/(admin)/admin/operations/intelligence/page.tsx",
      "src/app/(admin)/admin/leads/page.tsx",
      "src/app/(admin)/admin/residents/page.tsx",
      "src/app/(admin)/admin/residents/new/page.tsx",
      "src/app/(admin)/admin/finance/page.tsx",
      "src/app/(admin)/admin/finance/collections/page.tsx",
      "src/app/(admin)/admin/finance/followups/page.tsx",
      "src/app/(admin)/admin/finance/receipts/page.tsx",
      "src/app/(admin)/admin/finance/reconciliation/page.tsx",
      "src/app/(admin)/admin/finance/payment-security/page.tsx",
      "src/app/(admin)/admin/payments/page.tsx",
      "src/app/(admin)/admin/leaves/page.tsx",
      "src/app/(admin)/admin/notices/page.tsx",
      "src/app/(admin)/admin/website/page.tsx",
      "src/app/(admin)/admin/gallery/page.tsx",
      "src/app/(admin)/admin/reports/page.tsx",
      "src/app/(admin)/admin/alerts/page.tsx",
      "src/app/(admin)/admin/password-resets/page.tsx",
      "src/app/(admin)/admin/launch-readiness/page.tsx",
      "src/app/(admin)/admin/operations/automation/page.tsx",
      "src/app/(admin)/admin/settings/staff-access/page.tsx",
      "src/app/(admin)/admin/settings/rules/page.tsx",
      "src/app/(admin)/admin/settings/page.tsx",
      "src/app/(resident)/resident/dashboard/page.tsx",
      "src/app/(resident)/resident/pay-fees/page.tsx",
      "src/app/(resident)/resident/payments/page.tsx",
      "src/app/(resident)/resident/notices/page.tsx",
      "src/app/(resident)/resident/rules/page.tsx",
      "src/app/(resident)/resident/support/page.tsx",
      "src/app/(resident)/resident/profile/page.tsx",
      "src/app/(resident)/resident/leave/page.tsx",
      "src/app/(resident)/resident/security/page.tsx",
    ]

    for (const file of routeFiles) {
      expect(existsSync(join(root, file)), `${file} should exist`).toBe(true)
    }
  })

  it("keeps operations pages visible when optional datasets fail", () => {
    const operations = source("src/components/admin/operations/operations-center-client.tsx")
    const intelligence = source("src/components/admin/operations/competitive-intelligence-client.tsx")

    expect(operations).toContain("PartialDataBanner")
    expect(operations).toContain("Some operations data could not load")
    expect(operations).not.toContain("Operations Center could not load")
    expect(intelligence).toContain("PartialDataBanner")
    expect(intelligence).toContain("Some intelligence data could not load")
    expect(intelligence).not.toContain("Competitive intelligence could not load")
  })
})
