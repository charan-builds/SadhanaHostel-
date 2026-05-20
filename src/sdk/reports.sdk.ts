import { getCurrentAccessToken } from "@/lib/api-client"
import { buildApiUrl, createRequestId } from "@/lib/api-client/request-builder"
import type {
  ReportRequestInput,
  ReportType,
} from "@/validations/report.validation"

export type ReportDownload = {
  blob: Blob
  fileName: string
  contentType: string
}

export const reportsSdk = {
  async download(type: ReportType, params: ReportRequestInput): Promise<ReportDownload> {
    const token = await getCurrentAccessToken()
    const headers = new Headers({
      accept: params.format === "xlsx" ? "application/vnd.ms-excel" : "text/csv",
      "x-request-id": createRequestId(),
    })

    if (token) {
      headers.set("authorization", `Bearer ${token}`)
    }

    const response = await fetch(buildApiUrl(`/api/v1/reports/${type}`, params), {
      method: "GET",
      credentials: "include",
      headers,
    })

    if (!response.ok) {
      throw new Error(`Report export failed with status ${response.status}.`)
    }

    return {
      blob: await response.blob(),
      fileName: getFileName(response.headers.get("content-disposition"), type, params.format),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
    }
  },
}

function getFileName(
  contentDisposition: string | null,
  type: string,
  format: "csv" | "xlsx"
) {
  const match = contentDisposition?.match(/filename="([^"]+)"/)

  return match?.[1] ?? `${type}.${format === "xlsx" ? "xls" : "csv"}`
}
