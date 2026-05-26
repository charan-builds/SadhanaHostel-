import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

export type Check = {
  name: string
  status: "pass" | "warn" | "fail"
  details: string
}

type EnvMap = Record<string, string | undefined>

const PLACEHOLDER_MARKERS = [
  "00000000-0000-4000-8000-000000000000",
  "changeme",
  "example.com",
  "placeholder",
  "redacted",
  "replace_me",
  "todo",
  "your-",
]

const PUBLIC_SECRET_PATTERN =
  /(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD|TOKEN|AUTH_TOKEN|RESEND|CRON|DATABASE_URL)/i

export function collectEnv(fileCandidates: string[] = [".env.staging", ".env.local", ".env"]) {
  const fileEnv = fileCandidates.reduce<EnvMap>((accumulator, filePath) => {
    if (!existsSync(filePath)) {
      return accumulator
    }

    return {
      ...parseEnvFile(filePath),
      ...accumulator,
    }
  }, {})

  return {
    ...fileEnv,
    ...process.env,
  } satisfies EnvMap
}

export function checkFile(filePath: string): Check {
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

export function checkCommand(command: string, required: boolean): Check {
  const pathResult = spawnSync("bash", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
  })
  const path = pathResult.stdout.trim()

  if (!path) {
    return {
      name: `tool:${command}`,
      status: required ? "fail" : "warn",
      details: required
        ? "Install before real staging execution."
        : "Optional locally if provider is configured through CI.",
    }
  }

  const version = readToolVersion(command)

  return {
    name: `tool:${command}`,
    status: "pass",
    details: version ? `${path} (${version})` : path,
  }
}

export function checkEnv(name: string, required: boolean, env: EnvMap): Check {
  const value = env[name]?.trim()

  if (!value) {
    return {
      name: `env:${name}`,
      status: required ? "fail" : "warn",
      details: required
        ? "Missing for real staging execution."
        : "Recommended for production-grade launch operations.",
    }
  }

  if (isPlaceholder(value)) {
    return {
      name: `env:${name}`,
      status: required ? "fail" : "warn",
      details: "Configured value is still a placeholder.",
    }
  }

  return {
    name: `env:${name}`,
    status: "pass",
    details: "Set.",
  }
}

export function checkEnvironmentSafety(
  env: EnvMap,
  target: "staging" | "soft_launch"
): Check[] {
  const appUrl = env.NEXT_PUBLIC_APP_URL
  const loadUrl = env.LOAD_TEST_BASE_URL
  const launchMode = env.LAUNCH_MODE ?? env.NEXT_PUBLIC_LAUNCH_MODE
  const sentryEnvironment = env.SENTRY_ENVIRONMENT ?? env.NEXT_PUBLIC_SENTRY_ENVIRONMENT
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const publicSecretKeys = Object.keys(env).filter(
    (key) => key.startsWith("NEXT_PUBLIC_") && PUBLIC_SECRET_PATTERN.test(key) && env[key]?.trim()
  )
  const checks: Check[] = []

  checks.push({
    name: "env:isolation:app-url",
    status: isOperationalUrl(appUrl) ? "pass" : "fail",
    details: isOperationalUrl(appUrl)
      ? "Application URL points at an operational environment."
      : "NEXT_PUBLIC_APP_URL must not be localhost, example.com, or a placeholder for staging/soft launch.",
  })

  checks.push({
    name: "env:isolation:load-url",
    status: !loadUrl || isOperationalUrl(loadUrl) ? (loadUrl ? "pass" : "warn") : "fail",
    details: !loadUrl
      ? "LOAD_TEST_BASE_URL is not set; authenticated k6 cannot run."
      : isOperationalUrl(loadUrl)
        ? "Load-test URL points at an operational environment."
        : "LOAD_TEST_BASE_URL must not be localhost, example.com, or a placeholder.",
  })

  checks.push({
    name: "env:isolation:launch-mode",
    status:
      target === "staging"
        ? launchMode === "staging"
          ? "pass"
          : "fail"
        : launchMode === "soft_launch" || launchMode === "staging"
          ? "pass"
          : "fail",
    details:
      target === "staging"
        ? "Staging execution must use LAUNCH_MODE=staging."
        : "Soft-launch validation must use LAUNCH_MODE=soft_launch or staging.",
  })

  const expectedSentryEnvironments =
    target === "staging" ? ["staging"] : ["staging", "soft_launch"]
  const sentryEnvironmentMatches = sentryEnvironment
    ? expectedSentryEnvironments.includes(sentryEnvironment)
    : false

  checks.push({
    name: "env:isolation:sentry-environment",
    status: sentryEnvironmentMatches ? "pass" : target === "staging" ? "fail" : "warn",
    details: sentryEnvironmentMatches
      ? `Sentry environment is ${sentryEnvironment}.`
      : `Sentry environment should be ${expectedSentryEnvironments.join(" or ")} for pre-launch validation.`,
  })

  checks.push({
    name: "env:isolation:supabase-keys",
    status: anonKey && serviceRoleKey && anonKey !== serviceRoleKey ? "pass" : "fail",
    details:
      anonKey && serviceRoleKey && anonKey !== serviceRoleKey
        ? "Supabase anon and service-role keys are distinct."
        : "Supabase anon and service-role keys are missing or identical.",
  })

  checks.push({
    name: "env:client-secret-exposure",
    status: publicSecretKeys.length > 0 ? "fail" : "pass",
    details:
      publicSecretKeys.length > 0
        ? `Server secret-like variables are exposed with NEXT_PUBLIC_: ${publicSecretKeys.join(", ")}.`
        : "No server secret-like keys are exposed with NEXT_PUBLIC_.",
  })

  if (env.PRODUCTION_SUPABASE_URL || env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY) {
    checks.push({
      name: "env:isolation:production-reuse",
      status:
        env.PRODUCTION_SUPABASE_URL !== env.NEXT_PUBLIC_SUPABASE_URL &&
        env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY !== env.SUPABASE_SERVICE_ROLE_KEY
          ? "pass"
          : "fail",
      details:
        "When production comparison env vars are provided, staging Supabase URL and service key must differ.",
    })
  }

  if (target === "staging") {
    checks.push({
      name: "env:isolation:cashfree",
      status: !env.CASHFREE_ENV || env.CASHFREE_ENV === "sandbox" ? "pass" : "fail",
      details: "Staging must use CASHFREE_ENV=sandbox or leave Cashfree disabled.",
    })
  }

  return checks
}

function parseEnvFile(filePath: string) {
  const parsed: EnvMap = {}

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith("#")) {
      continue
    }

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line
    const separatorIndex = normalized.indexOf("=")

    if (separatorIndex <= 0) {
      continue
    }

    const key = normalized.slice(0, separatorIndex).trim()
    const value = normalized.slice(separatorIndex + 1).trim()

    parsed[key] = unquote(value)
  }

  return parsed
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function isPlaceholder(value: string) {
  const normalized = value.toLowerCase()

  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))
}

function isOperationalUrl(value?: string) {
  if (!value || isPlaceholder(value)) {
    return false
  }

  try {
    const url = new URL(value)

    return !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)
  } catch {
    return false
  }
}

function readToolVersion(command: string) {
  const flag = command === "vercel" ? "--version" : "--version"
  const result = spawnSync(command, [flag], {
    encoding: "utf8",
    timeout: 5000,
  })
  const output = `${result.stdout}\n${result.stderr}`.trim()

  if (!output) {
    return null
  }

  return output.split(/\r?\n/)[0]?.trim() ?? null
}
