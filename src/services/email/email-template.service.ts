import "server-only"

import type { Json } from "@/types/database"

export type EmailTemplateKey =
  | "payment_receipt"
  | "payment_reminder"
  | "resident_onboarding"
  | "password_reset"
  | "leave_approved"
  | "leave_rejected"
  | "leave_status_parent_notification"
  | "notification_generic"

export type RenderedEmailTemplate = {
  subject: string
  html: string
  text: string
}

export class EmailTemplateService {
  render(key: string | null | undefined, input: {
    title: string
    body: string
    payload?: Json
  }): RenderedEmailTemplate {
    const templateKey = normalizeTemplateKey(key)
    const payload = toObject(input.payload)

    switch (templateKey) {
      case "payment_receipt":
        return this.layout({
          subject: "Payment receipt from Sadhana Boys Hostel",
          eyebrow: "Payment receipt",
          title: input.title,
          body: input.body,
          rows: [
            ["Amount", formatCurrency(payload.amount)],
            ["Payment ID", stringify(payload.payment_id)],
            ["Receipt", stringify(payload.invoice_number ?? payload.receipt_number)],
          ],
        })
      case "payment_reminder":
        return this.layout({
          subject: "Hostel fee payment reminder",
          eyebrow: "Fee reminder",
          title: input.title,
          body: input.body,
          rows: [
            ["Fee month", stringify(payload.period_month)],
            ["Pending balance", formatCurrency(payload.balance_amount)],
          ],
        })
      case "resident_onboarding":
        return this.layout({
          subject: "Welcome to Sadhana Boys Hostel",
          eyebrow: "Resident onboarding",
          title: input.title,
          body: input.body,
          ctaLabel: "Open resident portal",
          ctaUrl: stringify(payload.portal_url),
        })
      case "password_reset":
        return this.layout({
          subject: "Reset your Sadhana Boys Hostel password",
          eyebrow: "Password reset",
          title: input.title,
          body: input.body,
          ctaLabel: "Reset password",
          ctaUrl: stringify(payload.reset_url),
        })
      case "leave_approved":
      case "leave_rejected":
      case "leave_status_parent_notification":
        return this.layout({
          subject: input.title,
          eyebrow: "Leave request update",
          title: input.title,
          body: input.body,
          rows: [
            ["Leave request", stringify(payload.leave_request_id)],
            ["Status", stringify(payload.status)],
          ],
        })
      case "notification_generic":
      default:
        return this.layout({
          subject: input.title,
          eyebrow: "Hostel notification",
          title: input.title,
          body: input.body,
        })
    }
  }

  private layout(input: {
    subject: string
    eyebrow: string
    title: string
    body: string
    rows?: Array<[string, string]>
    ctaLabel?: string
    ctaUrl?: string
  }): RenderedEmailTemplate {
    const rows = input.rows?.filter(([, value]) => value && value !== "-") ?? []
    const cta =
      input.ctaLabel && input.ctaUrl
        ? `<p style="margin:24px 0 0"><a href="${escapeHtml(input.ctaUrl)}" style="background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:6px;font-weight:600;display:inline-block">${escapeHtml(input.ctaLabel)}</a></p>`
        : ""
    const table =
      rows.length > 0
        ? `<table style="border-collapse:collapse;width:100%;margin-top:20px">${rows
            .map(
              ([label, value]) =>
                `<tr><td style="border-top:1px solid #e5e7eb;padding:10px 0;color:#64748b">${escapeHtml(label)}</td><td style="border-top:1px solid #e5e7eb;padding:10px 0;text-align:right;font-weight:600">${escapeHtml(value)}</td></tr>`
            )
            .join("")}</table>`
        : ""

    const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:28px">
        <p style="margin:0 0 8px;color:#0f766e;text-transform:uppercase;font-size:12px;letter-spacing:.04em;font-weight:700">${escapeHtml(input.eyebrow)}</p>
        <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px">${escapeHtml(input.title)}</h1>
        <p style="font-size:15px;line-height:1.7;margin:0;color:#334155">${escapeHtml(input.body)}</p>
        ${table}
        ${cta}
      </div>
      <p style="font-size:12px;line-height:1.6;color:#64748b;margin:16px 0 0">Sadhana Boys Hostel Platform notification. Please contact the hostel office if this message looks unexpected.</p>
    </div>
  </body>
</html>`

    return {
      subject: input.subject,
      html,
      text: [
        input.eyebrow,
        input.title,
        input.body,
        ...rows.map(([label, value]) => `${label}: ${value}`),
        input.ctaUrl ? `${input.ctaLabel}: ${input.ctaUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    }
  }
}

function normalizeTemplateKey(key: string | null | undefined): EmailTemplateKey {
  const known: EmailTemplateKey[] = [
    "payment_receipt",
    "payment_reminder",
    "resident_onboarding",
    "password_reset",
    "leave_approved",
    "leave_rejected",
    "leave_status_parent_notification",
    "notification_generic",
  ]

  return known.includes(key as EmailTemplateKey)
    ? (key as EmailTemplateKey)
    : "notification_generic"
}

function toObject(value: Json | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringify(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "-"
  }

  return String(value)
}

function formatCurrency(value: unknown) {
  if (typeof value !== "number") {
    return stringify(value)
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
