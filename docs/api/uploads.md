# Uploads API

## Purpose

Document secure Supabase Storage upload endpoints for resident documents, payment proofs, and profile photos.

## Endpoints

| Method | Path | Bucket | Rate Limit |
| --- | --- | --- | --- |
| `POST` | `/api/uploads/document` | `resident-documents` | `uploads.write` |
| `POST` | `/api/uploads/payment-proof` | `payment-screenshots` | `uploads.write` |
| `GET` | `/api/uploads/payment-proof/:paymentId` | `payment-screenshots` signed URL | `uploads.write` |
| `POST` | `/api/uploads/profile-photo` | `resident-documents` | `uploads.write` |

## Multipart Contract

```txt
file=<binary>
organizationId=<uuid>
hostelId=<uuid>
residentId=<uuid>
documentType=aadhaar
```

## Validation Rules

| Upload | Max Size | MIME Types |
| --- | --- | --- |
| Resident documents | 5 MB | PDF, JPEG, PNG, WebP |
| Payment proof | 4 MB | JPEG, PNG, WebP |
| Profile photo | 4 MB | JPEG, PNG, WebP |

## Security Notes

- Residents may upload only for their own resident profile.
- Admin/staff uploads are limited to their organization.
- Storage paths include `organizationId/residentId`.
- Failed metadata writes remove the uploaded object.
- Payment proof uploads require a linked `paymentId` and must match the same resident, hostel, and organization.
- Payment verification is blocked until a non-rejected proof document exists for the payment.

## TODO

- Add checksum validation.
- Add malware scanning workflow.
- Add signed download endpoint.
