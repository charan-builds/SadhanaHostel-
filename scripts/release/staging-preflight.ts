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
  "SUPABASE_SERVICE_ROLE_KEY",
  "STAGING_SEED_ORGANIZATION_ID",
  "STAGING_SEED_HOSTEL_ID",
  "LOAD_TEST_BASE_URL",
]

function main() {
  const env = collectEnv([".env.staging", ".env.local", ".env"])
  const checks: Check[] = [
    ...requiredFiles.map(checkFile),
    ...requiredTools.map((tool) => checkCommand(tool, true)),
    ...optionalTools.map((tool) => checkCommand(tool, false)),
    ...requiredEnv.map((name) => checkEnv(name, true, env)),
    ...checkEnvironmentSafety(env, "staging"),
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
