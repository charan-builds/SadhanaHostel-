export type ReportCell = string | number | boolean | null

export type ReportRow = Record<string, ReportCell>

export type ReportColumn = {
  key: string
  label: string
}

export type ReportDefinition = {
  fileName: string
  columns: ReportColumn[]
  rows: AsyncIterable<ReportRow>
}
