import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"

type Check = {
  name: string
  status: "pass" | "warn" | "fail"
  details: string
}

const strict = process.argv.includes("--strict")

const requiredFiles = [
  "docs/launch/soft-launch-checklist.md",
  "docs/launch/controlled-soft-launch-readiness-report.md",
  "docs/operations/support-handbook.md",
  "docs/operations/incident-response-guide.md",
  "docs/operations/first-30-days-operations-guide.md",
  "scripts/load-testing/sadhana-hostel.load.js",
  "playwright.config.ts",
]

const requiredEnv = [
  "DEPLOYMENT_URL",
  "LOAD_TEST_BASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]

const recommendedEnv = [
  "SENTRY_DSN",
  "SENTRY_ENVIRONMENT",
  "CRON_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "LAUNCH_SUPPORT_WHATSAPP",
  "LAUNCH_OWNER_EMAIL",
]

const requiredTools = ["node", "npm", "k6", "supabase"]
const recommendedTools = ["sentry-cli", "vercel"]

function main() {
  const checks: Check[] = [
    ...requiredFiles.map(checkFile),
    ...requiredTools.map((tool) => checkCommand(tool, true)),
    ...recommendedTools.map((tool) => checkCommand(tool, false)),
    ...requiredEnv.map((name) => checkEnv(name, true)),
    ...recommendedEnv.map((name) => checkEnv(name, false)),
  ]
  const failures = checks.filter((check) => check.status === "fail")
  const warnings = checks.filter((check) => check.status === "warn")
  const commands = [
    "npm run lint",
    "npm run typecheck",
    "npm run test",
    "npm run build",
    "DEPLOYMENT_URL=$DEPLOYMENT_URL npm run ci:deployment-health",
    "E2E_AUTH_RUN_REAL_FLOWS=true PLAYWRIGHT_BASE_URL=$DEPLOYMENT_URL npm run test:smoke",
    "LOAD_TEST_BASE_URL=$LOAD_TEST_BASE_URL LOAD_TEST_SCENARIOS=health,resident,admin,uploads,realtime npm run load:k6",
    "supabase db push --dry-run",
  ]

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        strict,
        summary: {
          passed: checks.length - failures.length - warnings.length,
          warnings: warnings.length,
          failures: failures.length,
        },
        checks,
        requiredExecution: commands,
        goNoGo:
          failures.length > 0
            ? "NO_GO: resolve failed checks before inviting real residents."
            : warnings.length > 0
              ? "CONDITIONAL_GO: owner must accept warnings and record mitigations."
              : "GO: prerequisites are ready for controlled soft launch execution.",
      },
      null,
      2
    )
  )

  if (strict && failures.length > 0) {
    process.exitCode = 1
  }
}

function checkFile(filePath: string): Check {
  return existsSync(filePath)
    ? { name: `file:${filePath}`, status: "pass", details: "Found." }
    : {
        name: `file:${filePath}`,
        status: "fail",
        details: "Missing launch runbook or validation artifact.",
      }
}

function checkEnv(name: string, required: boolean): Check {
  return process.env[name]
    ? { name: `env:${name}`, status: "pass", details: "Set." }
    : {
        name: `env:${name}`,
        status: required ? "fail" : "warn",
        details: required
          ? "Required for real soft-launch validation."
          : "Recommended for production-grade launch operations.",
      }
}

function checkCommand(command: string, required: boolean): Check {
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
  })
  const path = result.stdout.trim()

  if (path) {
    return { name: `tool:${command}`, status: "pass", details: path }
  }

  return {
    name: `tool:${command}`,
    status: required ? "fail" : "warn",
    details: required ? "Install before launch validation." : "Recommended for full validation.",
  }
}

main()
