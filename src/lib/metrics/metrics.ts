import { logger } from "@/lib/logger"

export type MetricTags = Record<string, string | number | boolean | null | undefined>

export type CounterMetric = {
  name: string
  value: number
  tags: MetricTags
}

export type TimingMetric = CounterMetric & {
  durationMs: number
}

const counters = new Map<string, number>()
const timings = new Map<string, number[]>()

export function incrementMetric(
  name: string,
  value = 1,
  tags: MetricTags = {}
) {
  const key = metricKey(name, tags)
  const nextValue = (counters.get(key) ?? 0) + value

  counters.set(key, nextValue)

  logger.debug({
    event: "metric.counter",
    message: "Counter metric recorded.",
    metadata: {
      name,
      value,
      tags,
      total: nextValue,
    },
  })
}

export function recordTimingMetric(
  name: string,
  durationMs: number,
  tags: MetricTags = {}
) {
  const key = metricKey(name, tags)
  const values = timings.get(key) ?? []

  values.push(durationMs)
  timings.set(key, values.slice(-500))

  logger.debug({
    event: "metric.timing",
    message: "Timing metric recorded.",
    durationMs,
    metadata: {
      name,
      tags,
    },
  })
}

export function getMetricsSnapshot() {
  return {
    counters: Object.fromEntries(counters.entries()),
    timings: Object.fromEntries(
      [...timings.entries()].map(([key, values]) => [
        key,
        {
          count: values.length,
          avgMs:
            values.length === 0
              ? 0
              : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
          maxMs: values.length === 0 ? 0 : Math.max(...values),
        },
      ])
    ),
  }
}

export function resetMetrics() {
  counters.clear()
  timings.clear()
}

function metricKey(name: string, tags: MetricTags) {
  const normalizedTags = Object.entries(tags)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",")

  return normalizedTags ? `${name}{${normalizedTags}}` : name
}
