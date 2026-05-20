"use client"

import { useMutation } from "@tanstack/react-query"

import { uploadsSdk, type UploadProgress } from "@/sdk"
import type {
  UploadDocumentInput,
  UploadPaymentProofInput,
  UploadProfilePhotoInput,
} from "@/validations/upload.validation"

export function useDocumentUpload(options?: {
  onProgress?: (progress: UploadProgress) => void
}) {
  return useMutation({
    mutationFn: ({ input, file }: { input: UploadDocumentInput; file: File }) =>
      uploadsSdk.document(input, file, { onProgress: options?.onProgress }),
  })
}

export function usePaymentProofUpload(options?: {
  onProgress?: (progress: UploadProgress) => void
}) {
  return useMutation({
    mutationFn: ({ input, file }: { input: UploadPaymentProofInput; file: File }) =>
      uploadsSdk.paymentProof(input, file, { onProgress: options?.onProgress }),
  })
}

export function useProfilePhotoUpload(options?: {
  onProgress?: (progress: UploadProgress) => void
}) {
  return useMutation({
    mutationFn: ({ input, file }: { input: UploadProfilePhotoInput; file: File }) =>
      uploadsSdk.profilePhoto(input, file, { onProgress: options?.onProgress }),
  })
}
