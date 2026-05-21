import {
  FrontendApiError,
  apiClient,
  getCurrentAccessToken,
  type ApiResponse,
} from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  UploadDocumentInput,
  UploadPaymentProofInput,
  UploadProfilePhotoInput,
  PaymentProofLookupInput,
} from "@/validations/upload.validation"

import type { UploadProgress } from "./types"

export type UploadResult = {
  document: Tables<"documents">
  signedUrl: string
}

export type PaymentProofPreview = {
  document: Tables<"documents">
  paymentId: string
  signedUrl: string
  expiresInSeconds: number
}

export type UploadOptions = {
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}

export const uploadsSdk = {
  document(input: UploadDocumentInput, file: File, options?: UploadOptions) {
    return uploadFile<UploadResult>("/api/uploads/document", input, file, options)
  },

  paymentProof(input: UploadPaymentProofInput, file: File, options?: UploadOptions) {
    return uploadFile<UploadResult>(
      "/api/uploads/payment-proof",
      input,
      file,
      options
    )
  },

  paymentProofPreview(input: PaymentProofLookupInput) {
    const { paymentId, ...query } = input

    return apiClient.get<PaymentProofPreview>(
      `/api/uploads/payment-proof/${paymentId}`,
      query
    )
  },

  profilePhoto(input: UploadProfilePhotoInput, file: File, options?: UploadOptions) {
    return uploadFile<UploadResult>(
      "/api/uploads/profile-photo",
      input,
      file,
      options
    )
  },
}

async function uploadFile<TData>(
  path: string,
  fields: Record<string, unknown>,
  file: File,
  options?: UploadOptions
) {
  const formData = new FormData()

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.set(key, String(value))
    }
  })
  formData.set("file", file)

  return uploadWithProgress<TData>(path, formData, options)
}

async function uploadWithProgress<TData>(
  path: string,
  formData: FormData,
  options?: UploadOptions
) {
  const token = await getCurrentAccessToken()

  return new Promise<TData>((resolve, reject) => {
    const request = new XMLHttpRequest()

    request.open("POST", path)
    request.withCredentials = true
    request.setRequestHeader("accept", "application/json")
    request.setRequestHeader("x-request-id", crypto.randomUUID())

    if (token) {
      request.setRequestHeader("authorization", `Bearer ${token}`)
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return
      }

      options?.onProgress?.({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      })
    }

    request.onload = () => {
      const payload = parseUploadResponse<TData>(request)

      if (payload.success) {
        resolve(payload.data)
        return
      }

      reject(
        new FrontendApiError({
          code: payload.error.code,
          message: payload.error.message,
          status: request.status,
          requestId: payload.error.requestId,
          details: payload.error.details,
        })
      )
    }

    request.onerror = () => {
      reject(
        new FrontendApiError({
          code: "UPLOAD_NETWORK_ERROR",
          message: "Upload failed. Please check your connection and try again.",
          status: request.status || 0,
        })
      )
    }

    request.onabort = () => {
      reject(
        new FrontendApiError({
          code: "UPLOAD_ABORTED",
          message: "Upload was cancelled.",
          status: 0,
        })
      )
    }

    options?.signal?.addEventListener("abort", () => request.abort(), { once: true })
    request.send(formData)
  })
}

function parseUploadResponse<TData>(request: XMLHttpRequest): ApiResponse<TData> {
  try {
    return JSON.parse(request.responseText) as ApiResponse<TData>
  } catch {
    return {
      success: false,
      error: {
        code: `HTTP_${request.status}`,
        message: request.statusText || "Upload failed.",
        requestId: request.getResponseHeader("x-request-id") ?? undefined,
      },
    }
  }
}
