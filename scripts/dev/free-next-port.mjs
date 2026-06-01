#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import process from "node:process"

const port = Number(process.argv[2] ?? 3002)
const projectRoot = fs.realpathSync(process.cwd())

const listeners = findListeningPids(port)

if (listeners.length === 0) {
  process.exit(0)
}

const processes = listProcesses()
const killable = new Set()
const blocked = []

for (const pid of listeners) {
  if (!belongsToThisProject(pid, processes)) {
    blocked.push(pid)
    continue
  }

  collectRelatedPids(pid, processes).forEach((relatedPid) => killable.add(relatedPid))
}

if (blocked.length > 0) {
  console.error(
    `Port ${port} is already used by a non-project process: ${blocked.join(", ")}.`
  )
  process.exit(1)
}

if (killable.size > 0) {
  const pids = [...killable].sort((a, b) => b - a)

  console.log(`Clearing stale Next dev server on port ${port}: ${pids.join(", ")}`)
  terminate(pids, "SIGTERM")
  sleep(350)
  terminate(pids.filter(isAlive), "SIGKILL")
}

function findListeningPids(targetPort) {
  const output = execFileSync("ss", ["-ltnp"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  const pidPattern = /pid=(\d+)/g
  const pids = new Set()

  for (const line of output.split("\n")) {
    if (!line.includes(`:${targetPort}`)) {
      continue
    }

    for (const match of line.matchAll(pidPattern)) {
      pids.add(Number(match[1]))
    }
  }

  return [...pids]
}

function listProcesses() {
  const output = execFileSync("ps", ["-eo", "pid=", "-o", "ppid=", "-o", "args="], {
    encoding: "utf8",
  })
  const processes = new Map()

  for (const line of output.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/)

    if (!match) {
      continue
    }

    processes.set(Number(match[1]), {
      pid: Number(match[1]),
      ppid: Number(match[2]),
      args: match[3],
    })
  }

  return processes
}

function belongsToThisProject(pid, processes) {
  let current = processes.get(pid)
  let guard = 0

  while (current && guard < 20) {
    if (isNextProcess(current.args) && cwdMatches(current.pid)) {
      return true
    }

    current = processes.get(current.ppid)
    guard += 1
  }

  return false
}

function collectRelatedPids(pid, processes) {
  const related = new Set([pid])
  const queue = [pid]

  while (queue.length > 0) {
    const currentPid = queue.shift()

    for (const processInfo of processes.values()) {
      if (processInfo.ppid === currentPid && cwdMatches(processInfo.pid)) {
        related.add(processInfo.pid)
        queue.push(processInfo.pid)
      }
    }
  }

  let current = processes.get(pid)
  let guard = 0

  while (current && guard < 20) {
    if (cwdMatches(current.pid) && isDevWrapper(current.args)) {
      related.add(current.pid)
      current = processes.get(current.ppid)
      guard += 1
      continue
    }

    break
  }

  return related
}

function cwdMatches(pid) {
  try {
    return fs.realpathSync(`/proc/${pid}/cwd`) === projectRoot
  } catch {
    return false
  }
}

function isNextProcess(args) {
  return /next-server|next dev|node .*next/.test(args)
}

function isDevWrapper(args) {
  return isNextProcess(args) || /npm run dev|sh -c next dev/.test(args)
}

function terminate(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal)
    } catch {
      // Already gone.
    }
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}
