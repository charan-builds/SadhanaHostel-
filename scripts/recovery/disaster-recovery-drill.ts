import { spawn } from "node:child_process"

type DrillStep = {
  name: string
  command: string
  args: string[]
  requiredEnv: string[]
}

const steps: DrillStep[] = [
  {
    name: "backup-check",
    command: "npm",
    args: ["run", "recovery:backup-check"],
    requiredEnv: ["DATABASE_URL"],
  },
  {
    name: "migration-verify",
    command: "npm",
    args: ["run", "recovery:migration-verify"],
    requiredEnv: ["MIGRATION_VERIFY_DATABASE_URL"],
  },
  {
    name: "restore-validation",
    command: "npm",
    args: ["run", "recovery:restore-validation"],
    requiredEnv: ["RESTORE_DATABASE_URL"],
  },
]

async function main() {
  const startedAt = Date.now()
  const results = []

  for (const step of steps) {
    ensureEnv(step)
    const result = await runStep(step)
    results.push(result)

    if (!result.passed) {
      break
    }
  }

  const passed = results.length === steps.length && results.every((result) => result.passed)

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        passed,
        results,
      },
      null,
      2
    )
  )

  if (!passed) {
    process.exitCode = 1
  }
}

function ensureEnv(step: DrillStep) {
  const missing = step.requiredEnv.filter((name) => !process.env[name])

  if (missing.length > 0) {
    throw new Error(`${step.name} requires ${missing.join(", ")}.`)
  }
}

function runStep(step: DrillStep) {
  const startedAt = Date.now()

  return new Promise<{ name: string; passed: boolean; durationMs: number }>((resolve) => {
    const child = spawn(step.command, step.args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    })

    child.on("close", (code) => {
      resolve({
        name: step.name,
        passed: code === 0,
        durationMs: Date.now() - startedAt,
      })
    })
  })
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
