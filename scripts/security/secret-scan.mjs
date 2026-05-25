#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "test-results",
  "playwright-report",
])
const ALLOWED_VALUE_PREFIXES = [
  "",
  "REDACTED",
  "redacted",
  "your-",
  "ci-",
  "test-",
  "placeholder",
  "replace-with",
  "example",
]

const rules = [
  {
    name: "jwt-shaped-token",
    regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    isAllowed: () => false,
  },
  {
    name: "private-key-block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g,
    isAllowed: () => false,
  },
  {
    name: "high-risk-env-assignment",
    regex:
      /(?:^|\n)[ \t]*([A-Z0-9_]*(?:SERVICE_ROLE_KEY|SECRET|TOKEN|PASSWORD|API_KEY)[A-Z0-9_]*)[ \t]*=[ \t]*([^\s#'"]+)/g,
    isAllowed: (_match, key, value) => isAllowedPlaceholder(key, value),
  },
  {
    name: "quoted-high-risk-assignment",
    regex:
      /(?:serviceRoleKey|service_role_key|authToken|apiKey|secretKey|password)\s*[:=]\s*["']([^"']{20,})["']/g,
    isAllowed: (_match, value) => isAllowedPlaceholder("", value),
  },
]

function main() {
  const files = getFiles()
  const findings = []

  for (const file of files) {
    if (!shouldScan(file)) continue

    const body = safeRead(file)
    if (body === null) continue

    for (const rule of rules) {
      for (const match of body.matchAll(rule.regex)) {
        if (rule.isAllowed(...match)) continue

        findings.push({
          file,
          rule: rule.name,
          line: lineNumber(body, match.index ?? 0),
        })
      }
    }
  }

  if (findings.length > 0) {
    console.error("Secret scan failed. Findings are redacted:")
    for (const finding of findings) {
      console.error(`- ${finding.file}:${finding.line} ${finding.rule}`)
    }
    process.exit(1)
  }

  console.log(`Secret scan passed (${files.length} file(s) checked).`)
}

function getFiles() {
  if (process.argv.includes("--staged")) {
    return execGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
  }

  const explicit = process.argv.slice(2).filter((arg) => !arg.startsWith("--"))

  if (explicit.length > 0) {
    return explicit
  }

  return [
    ...execGit(["ls-files"]),
    ...execGit(["ls-files", "--others", "--exclude-standard"]),
  ]
}

function execGit(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
}

function shouldScan(file) {
  if (!existsSync(file)) return false

  const normalized = file.split(path.sep)
  if (normalized.some((part) => SKIP_DIRS.has(part))) return false

  const stat = statSync(file)
  if (!stat.isFile() || stat.size > 2_000_000) return false

  return true
}

function safeRead(file) {
  const body = readFileSync(file)

  if (body.includes(0)) {
    return null
  }

  return body.toString("utf8")
}

function isAllowedPlaceholder(_key, rawValue) {
  const value = String(rawValue ?? "").trim().replace(/^["']|["']$/g, "")

  return ALLOWED_VALUE_PREFIXES.some((prefix) =>
    prefix === "" ? value === "" : value.toLowerCase().startsWith(prefix.toLowerCase())
  )
}

function lineNumber(body, index) {
  return body.slice(0, index).split("\n").length
}

main()
