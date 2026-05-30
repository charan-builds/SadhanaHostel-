import {
  FrontendApiError,
  getCurrentAccessToken,
  notifyApiAuthFailure,
  type ApiResponse,
} from "@/lib/api-client"
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
    const requestId = createRequestId()
    const path = `/api/v1/reports/${type}`
    const headers = new Headers({
      accept: params.format === "xlsx" ? "application/vnd.ms-excel" : "text/csv",
      "x-request-id": requestId,
    })

    if (token) {
      headers.set("authorization", `Bearer ${token}`)
    }

    const response = await fetch(buildApiUrl(path, params), {
      method: "GET",
      credentials: "include",
      headers,
    })

    if (!response.ok) {
      const error = await downloadError(response, requestId, "Report export failed.")
      notifyApiAuthFailure(path, error)
      throw error
    }

    return {
      blob: await response.blob(),
      fileName: getFileName(response.headers.get("content-disposition"), type, params.format),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
    }
  },
}

async function downloadError(response: Response, requestId: string, fallback: string) {
  const payload = await readApiErrorPayload(response)

  return new FrontendApiError({
    code: payload?.error.code ?? `HTTP_${response.status}`,
    message: payload?.error.message ?? `${fallback} Status ${response.status}.`,
    status: response.status,
    requestId: payload?.error.requestId ?? response.headers.get("x-request-id") ?? requestId,
    details: payload?.error.details,
  })
}

async function readApiErrorPayload(response: Response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return null
  }

  try {
    const payload = (await response.json()) as ApiResponse<unknown>

    return payload.success === false ? payload : null
  } catch {
    return null
  }
}

function getFileName(
  contentDisposition: string | null,
  type: string,
  format: "csv" | "xlsx"
) {
  const match = contentDisposition?.match(/filename="([^"]+)"/)

  return match?.[1] ?? `${type}.${format === "xlsx" ? "xls" : "csv"}`
}
