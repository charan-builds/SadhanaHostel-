import {
  checkCommand,
  checkEnv,
  checkEnvironmentSafety,
  checkFile,
  collectEnv,
  type Check,
} from "./hardening-checks"

const strict = process.argv.includes("--strict")

const requiredFiles = [
  ".env.staging.example",
  ".github/workflows/backend-ci.yml",
  ".lighthouserc.json",
  "playwright.config.ts",
  "scripts/load-testing/sadhana-hostel.load.js",
  "scripts/staging-seed.ts",
  "docs/deployment/staging-checklist.md",
  "docs/deployment/rollback.md",
  "docs/security/pre-launch-security-checklist.md",
  "docs/qa/staging-uat-checklist.md",
  "docs/launch/go-live-checklist.md",
]

const requiredTools = ["supabase", "vercel", "k6"]
const optionalTools = ["sentry-cli"]
const requiredEnv = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID",
  "NEXT_PUBLIC_DEFAULT_HOSTEL_ID",
  "NEXT_PUBLIC_LAUNCH_MODE",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LAUNCH_MODE",
  "CRON_SECRET",
  "INVITE_TOKEN_SECRET",
  "STORAGE_SIGNED_URL_TTL_SECONDS",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_ENVIRONMENT",
  "SENTRY_DSN",
  "SENTRY_ENVIRONMENT",
  "STAGING_SEED_ORGANIZATION_ID",
  "STAGING_SEED_HOSTEL_ID",
  "LOAD_TEST_BASE_URL",
  "LOAD_TEST_ORGANIZATION_ID",
  "LOAD_TEST_HOSTEL_ID",
  "LOAD_TEST_RESIDENT_ID",
  "LOAD_TEST_ADMIN_EMAIL",
  "LOAD_TEST_ADMIN_PASSWORD",
  "LOAD_TEST_RESIDENT_EMAIL",
  "LOAD_TEST_RESIDENT_PASSWORD",
  "E2E_AUTH_RUN_REAL_FLOWS",
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
  "E2E_RESIDENT_EMAIL",
  "E2E_RESIDENT_PASSWORD",
]

function main() {
  const env = collectEnv([".env.staging", ".env.local", ".env"])
  const checks: Check[] = [
    ...requiredFiles.map(checkFile),
    ...requiredTools.map((tool) => checkCommand(tool, true)),
    ...optionalTools.map((tool) => checkCommand(tool, false)),
    ...requiredEnv.map((name) => checkEnv(name, true, env)),
    ...checkEnvironmentSafety(env, "staging"),
    ...checkStagingValueAlignment(env),
  ]
  const failed = checks.filter((check) => check.status === "fail")
  const warned = checks.filter((check) => check.status === "warn")

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        strict,
        summary: {
          passed: checks.length - failed.length - warned.length,
          warnings: warned.length,
          failures: failed.length,
        },
        checks,
        nextAction:
          failed.length > 0
            ? "Install missing tools, replace placeholder env vars, or fix staging isolation, then rerun preflight."
            : "Staging execution prerequisites are ready.",
      },
      null,
      2
    )
  )

  if (strict && failed.length > 0) {
    process.exitCode = 1
  }
}

main()

function checkStagingValueAlignment(env: Record<string, string | undefined>): Check[] {
  const checks: Check[] = []

  checks.push({
    name: "env:alignment:default-organization",
    status:
      env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID &&
      env.STAGING_SEED_ORGANIZATION_ID &&
      env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID === env.STAGING_SEED_ORGANIZATION_ID
        ? "pass"
        : "fail",
    details:
      "NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID must match STAGING_SEED_ORGANIZATION_ID for staging smoke/load tests.",
  })

  checks.push({
    name: "env:alignment:default-hostel",
    status:
      env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID &&
      env.STAGING_SEED_HOSTEL_ID &&
      env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID === env.STAGING_SEED_HOSTEL_ID
        ? "pass"
        : "fail",
    details:
      "NEXT_PUBLIC_DEFAULT_HOSTEL_ID must match STAGING_SEED_HOSTEL_ID for staging smoke/load tests.",
  })

  checks.push({
    name: "env:alignment:load-organization",
    status:
      env.LOAD_TEST_ORGANIZATION_ID &&
      env.STAGING_SEED_ORGANIZATION_ID &&
      env.LOAD_TEST_ORGANIZATION_ID === env.STAGING_SEED_ORGANIZATION_ID
        ? "pass"
        : "fail",
    details:
      "LOAD_TEST_ORGANIZATION_ID must match STAGING_SEED_ORGANIZATION_ID.",
  })

  checks.push({
    name: "env:alignment:load-hostel",
    status:
      env.LOAD_TEST_HOSTEL_ID &&
      env.STAGING_SEED_HOSTEL_ID &&
      env.LOAD_TEST_HOSTEL_ID === env.STAGING_SEED_HOSTEL_ID
        ? "pass"
        : "fail",
    details: "LOAD_TEST_HOSTEL_ID must match STAGING_SEED_HOSTEL_ID.",
  })

  checks.push({
    name: "env:alignment:e2e-enabled",
    status: env.E2E_AUTH_RUN_REAL_FLOWS === "true" ? "pass" : "fail",
    details: "E2E_AUTH_RUN_REAL_FLOWS=true is required for final credentialed staging validation.",
  })

  return checks
}
