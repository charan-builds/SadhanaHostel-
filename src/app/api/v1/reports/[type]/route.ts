import { getQueryParams, withApiRoute } from "@/lib/api"
import {
  CsvExportService,
  ExcelExportService,
  ReportBuilderService,
} from "@/services/reports"
import { reportFormatSchema } from "@/validations/report.validation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

type ReportRouteContext = {
  params: Promise<{ type: string }>
}

export async function GET(request: Request, context: ReportRouteContext) {
  const { type } = await context.params

  return withApiRoute(
    request,
    {
      route: `v1.reports.${type}`,
    },
    async () => {
      const query = getQueryParams(request)
      const format = reportFormatSchema.parse(query.format)
      const builder = await ReportBuilderService.create()
      const report = await builder.build(type, query)
      const exporter =
        format === "xlsx" ? new ExcelExportService() : new CsvExportService()
      const extension = format === "xlsx" ? "xls" : "csv"
      const contentType =
        format === "xlsx"
          ? "application/vnd.ms-excel; charset=utf-8"
          : "text/csv; charset=utf-8"

      return new Response(exporter.stream(report), {
        headers: {
          "content-type": contentType,
          "content-disposition": `attachment; filename="${report.fileName}.${extension}"`,
          "cache-control": "no-store",
        },
      })
    }
  )
}
