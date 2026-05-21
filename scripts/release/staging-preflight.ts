import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"

type Check = {
  name: string
  status: "pass" | "warn" | "fail"
  details: string
}

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
  const checks: Check[] = [
    ...requiredFiles.map(checkFile),
    ...requiredTools.map((tool) => checkCommand(tool, true)),
    ...optionalTools.map((tool) => checkCommand(tool, false)),
    ...requiredEnv.map(checkEnv),
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
            ? "Install missing tools or provide staging env vars, then rerun preflight."
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

function checkFile(filePath: string): Check {
  return existsSync(filePath)
    ? {
        name: `file:${filePath}`,
        status: "pass",
        details: "Found.",
      }
    : {
        name: `file:${filePath}`,
        status: "fail",
        details: "Missing required release artifact.",
      }
}

function checkCommand(command: string, required: boolean): Check {
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
  })
  const path = result.stdout.trim()

  if (path) {
    return {
      name: `tool:${command}`,
      status: "pass",
      details: path,
    }
  }

  return {
    name: `tool:${command}`,
    status: required ? "fail" : "warn",
    details: required
      ? "Install before real staging execution."
      : "Optional locally if provider is configured through CI.",
  }
}

function checkEnv(name: string): Check {
  const value = process.env[name]

  if (value) {
    return {
      name: `env:${name}`,
      status: "pass",
      details: "Set.",
    }
  }

  return {
    name: `env:${name}`,
    status: "fail",
    details: "Missing for real staging execution.",
  }
}

main()
