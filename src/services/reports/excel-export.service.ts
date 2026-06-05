import "server-only"

import { sanitizeCsvCell } from "@/lib/csv"
import type { ReportDefinition, ReportRow } from "./types"

export class ExcelExportService {
  stream(report: ReportDefinition) {
    const encoder = new TextEncoder()

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Report">
  <Table>
   <Row>${report.columns
     .map((column) => `<Cell><Data ss:Type="String">${xmlEscape(column.label)}</Data></Cell>`)
     .join("")}</Row>
`)
        )

        for await (const row of report.rows) {
          controller.enqueue(
            encoder.encode(
              `   <Row>${report.columns
                .map((column) => renderCell(row[column.key]))
                .join("")}</Row>\n`
            )
          )
        }

        controller.enqueue(
          encoder.encode(`  </Table>
 </Worksheet>
</Workbook>`)
        )
        controller.close()
      },
    })
  }
}

function renderCell(value: ReportRow[string]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
  }

  if (typeof value === "boolean") {
    return `<Cell><Data ss:Type="String">${value ? "Yes" : "No"}</Data></Cell>`
  }

  return `<Cell><Data ss:Type="String">${xmlEscape(sanitizeCsvCell(value))}</Data></Cell>`
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
