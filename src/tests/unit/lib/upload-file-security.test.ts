import { describe, expect, it } from "vitest"

import {
  inspectUploadFile,
  sanitizeUploadFileName,
} from "@/lib/uploads/file-security"

const VALID_PNG_BYTES = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
])
const VALID_WEBP_BYTES = new Uint8Array([
  0x52,
  0x49,
  0x46,
  0x46,
  0x00,
  0x00,
  0x00,
  0x00,
  0x57,
  0x45,
  0x42,
  0x50,
])

describe("upload file security", () => {
  it("rejects MIME spoofing before storage writes can happen", async () => {
    await expect(
      inspectUploadFile(
        new File(["<script>alert(1)</script>"], "avatar.png", {
          type: "image/png",
        }),
        {
          allowedMimeTypes: new Set(["image/png"]),
          maxBytes: 1024,
          label: "profile image",
        }
      )
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })

  it("normalizes path traversal and double-extension filenames to safe metadata", async () => {
    const result = await inspectUploadFile(
      new File([VALID_PNG_BYTES], "../../resident-card.php.png", {
        type: "image/png",
      }),
      {
        allowedMimeTypes: new Set(["image/png"]),
        maxBytes: 1024,
        label: "document",
      }
    )

    expect(result.safeFileName).toBe("resident-card-php.png")
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/)
  })

  it("uses the canonical extension for the accepted MIME type", async () => {
    const result = await inspectUploadFile(
      new File([VALID_WEBP_BYTES], "room-preview.jpeg", {
        type: "image/webp",
      }),
      {
        allowedMimeTypes: new Set(["image/webp"]),
        maxBytes: 1024,
        label: "gallery image",
      }
    )

    expect(result.safeFileName).toBe("room-preview.webp")
    expect(result.extension).toBe("webp")
  })

  it("falls back to a safe basename when the original name is unusable", () => {
    expect(sanitizeUploadFileName("../..", "pdf", "document")).toBe("document.pdf")
  })
})
