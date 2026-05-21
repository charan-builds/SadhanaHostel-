type CheckResult = {
  name: string
  passed: boolean
  status?: number
  details?: string
}

const deploymentUrl = normalizeUrl(requiredEnv("DEPLOYMENT_URL"))
const allowNotReady = process.env.ALLOW_NOT_READY === "true"

async function main() {
  const checks: CheckResult[] = []

  checks.push(await expectJson("live health", "/api/health/live", 200))
  checks.push(
    await expectJson("ready health", "/api/health/ready", allowNotReady ? [200, 503] : 200)
  )
  checks.push(await expectJson("openapi metadata", "/api/v1/openapi", 200))
  checks.push(await expectRedirect("admin protection", "/admin/dashboard"))
  checks.push(await expectRedirect("resident protection", "/resident/dashboard"))

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        deploymentUrl,
        checks,
      },
      null,
      2
    )
  )

  if (checks.some((check) => !check.passed)) {
    process.exitCode = 1
  }
}

async function expectJson(
  name: string,
  path: string,
  expectedStatus: number | number[]
) {
  try {
    const response = await fetch(`${deploymentUrl}${path}`, {
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    })
    const contentType = response.headers.get("content-type") ?? ""

    return {
      name,
      passed:
        normalizeStatuses(expectedStatus).includes(response.status) &&
        contentType.includes("application/json"),
      status: response.status,
      details: contentType,
    }
  } catch (error) {
    return failed(name, error)
  }
}

async function expectRedirect(name: string, path: string) {
  try {
    const response = await fetch(`${deploymentUrl}${path}`, {
      redirect: "manual",
      cache: "no-store",
    })
    const location = response.headers.get("location") ?? ""

    return {
      name,
      passed: [307, 308].includes(response.status) && location.includes("/login"),
      status: response.status,
      details: location,
    }
  } catch (error) {
    return failed(name, error)
  }
}

function failed(name: string, error: unknown): CheckResult {
  return {
    name,
    passed: false,
    details: error instanceof Error ? error.message : String(error),
  }
}

function normalizeStatuses(status: number | number[]) {
  return Array.isArray(status) ? status : [status]
}

function normalizeUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function requiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
