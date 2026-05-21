# Upload Flow Guide

## Purpose

Document secure frontend upload usage for Aadhaar, profile photos, and payment proof documents.

## Flow

```text
File input
-> upload hook
-> uploadsSdk
-> multipart API
-> backend validation
-> Supabase Storage
-> documents table
```

## Hooks

| Hook | Route |
| --- | --- |
| `useDocumentUpload()` | `/api/uploads/document` |
| `useProfilePhotoUpload()` | `/api/uploads/profile-photo` |
| `usePaymentProofUpload()` | `/api/uploads/payment-proof` |
| `usePaymentProofPreview()` | `/api/uploads/payment-proof/:paymentId` |

## Progress

Uploads use `XMLHttpRequest` for progress reporting.

```tsx
const upload = useDocumentUpload({
  onProgress: (progress) => setPercent(progress.percent),
})
```

## Security Rules

- Validate file type and size in the UI before calling the SDK.
- Backend remains the source of truth for bucket/path authorization.
- Do not build storage paths on the client.
- Do not expose signed URLs beyond the intended workflow.
- Payment proof uploads must include `paymentId`; generic document uploads may not create unlinked `payment_receipt` records.
- Admin payment verification is blocked until a linked proof document exists for the same resident and organization.

## Future Expansion

- Add resumable uploads for large files.
- Add client-side image compression for profile photos.
- Add virus-scanning status display when backend support is added.
