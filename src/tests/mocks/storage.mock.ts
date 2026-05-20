import { vi } from "vitest"

export function createStorageBucketMock() {
  return {
    upload: vi.fn().mockResolvedValue({
      data: {
        path: "organization/resident/file.pdf",
      },
      error: null,
    }),
    createSignedUrl: vi.fn().mockResolvedValue({
      data: {
        signedUrl: "https://storage.test/signed-url",
      },
      error: null,
    }),
    remove: vi.fn().mockResolvedValue({
      data: [],
      error: null,
    }),
  }
}

export function createSupabaseStorageMock() {
  const bucket = createStorageBucketMock()

  return {
    bucket,
    storage: {
      from: vi.fn().mockReturnValue(bucket),
    },
  }
}
