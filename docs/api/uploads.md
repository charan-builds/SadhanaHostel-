# Uploads API

## Purpose

Document secure Supabase Storage upload endpoints for resident documents, payment proofs, and profile photos.

## Endpoints

| Method | Path | Bucket | Rate Limit |
| --- | --- | --- | --- |
| `POST` | `/api/uploads/document` | `resident-documents` | `uploads.write` |
| `POST` | `/api/uploads/payment-proof` | `payment-screenshots` | `uploads.write` |
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

## TODO

- Add checksum validation.
- Add malware scanning workflow.
- Add signed download endpoint.
