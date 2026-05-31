import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api-client", () => ({
  FrontendApiError: class FrontendApiError extends Error {
    readonly code: string
    readonly status: number
    readonly requestId?: string
    readonly details?: unknown

    constructor(input: {
      code: string
      message: string
      status: number
      requestId?: string
      details?: unknown
    }) {
      super(input.message)
      this.name = "FrontendApiError"
      this.code = input.code
      this.status = input.status
      this.requestId = input.requestId
      this.details = input.details
    }
  },
  apiClient: {
    get: vi.fn(),
  },
  createRequestId: () => "upload-request-id",
  notifyApiAuthFailure: vi.fn(),
}))

class FakeXMLHttpRequest {
  static lastRequest: FakeXMLHttpRequest | null = null

  readonly headers = new Map<string, string>()
  readonly upload = { onprogress: null as ((event: ProgressEvent) => void) | null }
  method: string | null = null
  url: string | null = null
  withCredentials = false
  timeout = 0
  status = 201
  statusText = "Created"
  responseText = JSON.stringify({
    success: true,
    data: { document: { id: "document-id" }, signedUrl: "https://storage.test/file" },
    message: "Uploaded.",
  })
  sentBody: BodyInit | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  ontimeout: (() => void) | null = null

  constructor() {
    FakeXMLHttpRequest.lastRequest = this
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name.toLowerCase(), value)
  }

  getResponseHeader(name: string) {
    return this.headers.get(name.toLowerCase()) ?? null
  }

  send(body: BodyInit) {
    this.sentBody = body
    this.onload?.()
  }

  abort() {
    this.onabort?.()
  }
}

describe("uploadsSdk", () => {
  const originalXmlHttpRequest = globalThis.XMLHttpRequest

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXmlHttpRequest
    FakeXMLHttpRequest.lastRequest = null
    vi.resetModules()
  })

  it("uses cookie credentials for uploads without sending a bearer token", async () => {
    globalThis.XMLHttpRequest = FakeXMLHttpRequest as never

    const { uploadsSdk } = await import("@/sdk/uploads.sdk")
    const file = new File(["avatar"], "avatar.png", { type: "image/png" })

    await uploadsSdk.profilePhoto(
      {
        organizationId: "00000000-0000-4000-8000-000000000001",
        hostelId: "00000000-0000-4000-8000-000000000002",
        residentId: "00000000-0000-4000-8000-000000000003",
      },
      file
    )

    const request = FakeXMLHttpRequest.lastRequest

    expect(request?.method).toBe("POST")
    expect(request?.url).toBe("/api/uploads/profile-photo")
    expect(request?.withCredentials).toBe(true)
    expect(request?.headers.get("accept")).toBe("application/json")
    expect(request?.headers.get("x-request-id")).toBe("upload-request-id")
    expect(request?.headers.has("authorization")).toBe(false)
    expect(request?.sentBody).toBeInstanceOf(FormData)
  })
})
