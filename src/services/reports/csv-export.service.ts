import "server-only"

import { escapeCsvCell } from "@/lib/csv"
import type { ReportDefinition, ReportRow } from "./types"

export class CsvExportService {
  stream(report: ReportDefinition) {
    const encoder = new TextEncoder()

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`${report.columns.map((column) => csvEscape(column.label)).join(",")}\n`)
        )

        for await (const row of report.rows) {
          controller.enqueue(
            encoder.encode(`${renderCsvRow(report.columns.map((column) => row[column.key]))}\n`)
          )
        }

        controller.close()
      },
    })
  }
}

function renderCsvRow(values: ReportRow[string][]) {
  return values.map((value) => escapeCsvCell(value)).join(",")
}

function csvEscape(value: unknown) {
  return escapeCsvCell(value)
}
