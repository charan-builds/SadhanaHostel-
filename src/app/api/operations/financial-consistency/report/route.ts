import { getQueryParams, withApiRoute } from "@/lib/api"
import { ConsistencyService } from "@/services/operations"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    { route: "operations.financial_consistency.report" },
    async () => {
      const service = await ConsistencyService.create()
      const report = await service.getReport(getQueryParams(request))
      const rows = report.findings
        .filter((finding) => finding.id.startsWith("finance."))
        .flatMap((finding) =>
          (finding.details?.length ? finding.details : [null]).map((detail) => ({
            finding_id: finding.id,
            severity: finding.severity,
            title: finding.title,
            count: finding.count,
            repair_action: finding.repairAction,
            table_name: detail?.tableName ?? "",
            record_id: detail?.recordId ?? "",
            anomaly_type: detail?.anomalyType ?? "",
            recommendation: detail?.recommendation ?? "",
          }))
        )
      const csv = toCsv([
        [
          "finding_id",
          "severity",
          "title",
          "count",
          "repair_action",
          "table_name",
          "record_id",
          "anomaly_type",
          "recommendation",
        ],
        ...rows.map((row) => [
          row.finding_id,
          row.severity,
          row.title,
          String(row.count),
          row.repair_action,
          row.table_name,
          row.record_id,
          row.anomaly_type,
          row.recommendation,
        ]),
      ])

      return new Response(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="financial-consistency-${new Date()
            .toISOString()
            .slice(0, 10)}.csv"`,
        },
      })
    }
  )
}

function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${cell.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`)
        .join(",")
    )
    .join("\n")
}
