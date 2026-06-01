export const designTokens = {
  brand: {
    personality: ["professional", "trustworthy", "operational", "premium SaaS"],
    primary: "oklch(0.51 0.18 252)",
    accent: "oklch(0.67 0.16 188)",
    surface: "oklch(1 0 0 / 92%)",
  },
  typography: {
    display: { size: "3.5rem", lineHeight: "1", weight: 650 },
    title: { size: "2.25rem", lineHeight: "1.1", weight: 650 },
    section: { size: "1.375rem", lineHeight: "1.25", weight: 600 },
    body: { size: "0.9375rem", lineHeight: "1.6", weight: 400 },
    caption: { size: "0.8125rem", lineHeight: "1.45", weight: 500 },
  },
  spacing: {
    control: "0.5rem",
    card: "1rem",
    section: "1.5rem",
    page: "2rem",
    dashboard: "2.5rem",
  },
  radius: {
    control: "0.5rem",
    card: "0.7rem",
    modal: "0.7rem",
  },
  elevation: {
    soft: "0 18px 50px -32px rgb(15 23 42 / 45%)",
    lifted: "0 24px 70px -42px rgb(15 23 42 / 65%)",
    focus: "0 0 0 3px oklch(0.62 0.16 252 / 28%)",
  },
  status: {
    success: "oklch(0.56 0.15 158)",
    warning: "oklch(0.72 0.16 78)",
    info: "oklch(0.56 0.17 252)",
    destructive: "oklch(0.58 0.22 28)",
  },
} as const

export type DesignTokens = typeof designTokens
