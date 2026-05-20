import { logger } from "@/lib/logger"
import { recordTimingMetric, type MetricTags } from "@/lib/metrics"

export type ProfileOptions = {
  name: string
  kind: "api" | "service" | "repository" | "external"
  slowMs?: number
  tags?: MetricTags
}

export async function measureAsync<T>(
  options: ProfileOptions,
  callback: () => Promise<T>
) {
  const startedAt = performance.now()

  try {
    return await callback()
  } finally {
    recordProfile(options, performance.now() - startedAt)
  }
}

export function measureSync<T>(options: ProfileOptions, callback: () => T) {
  const startedAt = performance.now()

  try {
    return callback()
  } finally {
    recordProfile(options, performance.now() - startedAt)
  }
}

export function recordProfile(options: ProfileOptions, durationMs: number) {
  const roundedDurationMs = Math.round(durationMs)
  const metricName = `${options.kind}.${options.name}.duration`

  recordTimingMetric(metricName, roundedDurationMs, options.tags)

  if (roundedDurationMs >= (options.slowMs ?? 500)) {
    logger.warn({
      event: "performance.slow_operation",
      message: "Slow operation detected.",
      durationMs: roundedDurationMs,
      metadata: {
        name: options.name,
        kind: options.kind,
        tags: options.tags,
        slowMs: options.slowMs ?? 500,
      },
    })
  }
}
