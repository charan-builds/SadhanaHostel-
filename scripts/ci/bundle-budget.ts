import { readdir, stat } from "node:fs/promises"
import path from "node:path"

type FileSize = {
  file: string
  bytes: number
}

const STATIC_DIR = path.join(process.cwd(), ".next", "static")
const maxTotalBytes = Number(process.env.MAX_NEXT_STATIC_BYTES ?? 8 * 1024 * 1024)
const maxChunkBytes = Number(process.env.MAX_CLIENT_CHUNK_BYTES ?? 1024 * 1024)

async function main() {
  const files = await collectFiles(STATIC_DIR)
  const totalBytes = files.reduce((total, file) => total + file.bytes, 0)
  const oversizedChunks = files
    .filter((file) => file.file.endsWith(".js") && file.bytes > maxChunkBytes)
    .sort((a, b) => b.bytes - a.bytes)
  const largestFiles = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 10)
  const passed = totalBytes <= maxTotalBytes && oversizedChunks.length === 0

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        passed,
        budgets: {
          maxTotalBytes,
          maxChunkBytes,
        },
        actual: {
          totalBytes,
          fileCount: files.length,
          oversizedChunks,
          largestFiles,
        },
      },
      null,
      2
    )
  )

  if (!passed) {
    process.exitCode = 1
  }
}

async function collectFiles(directory: string): Promise<FileSize[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        return collectFiles(absolutePath)
      }

      const fileStat = await stat(absolutePath)

      return [
        {
          file: path.relative(process.cwd(), absolutePath),
          bytes: fileStat.size,
        },
      ]
    })
  )

  return files.flat()
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
