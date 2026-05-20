# File Upload System

## Purpose

Define backend file upload architecture for resident documents, gallery images, invoice PDFs, and future attachments.

## Scope

File domains:

- Resident documents.
- Gallery media.
- Invoice PDFs.
- Notice attachments.
- CMS images.

## Responsibilities

Backend owns:

- Storage bucket policies.
- Signed URLs.
- File validation.
- Metadata persistence.
- Access control.

Frontend owns:

- Upload UI.
- File picker validation for UX.
- Progress and error states.

## Architecture Overview

```txt
Frontend requests upload
  -> backend validates permission
  -> signed upload URL or server upload
  -> file stored in Supabase Storage
  -> metadata row inserted
  -> audit log for sensitive files
```

## Buckets

| Bucket | Access | Purpose |
| --- | --- | --- |
| `resident-documents` | Private | KYC, agreements |
| `gallery` | Public or signed published URLs | Website images |
| `invoices` | Private | Generated PDFs |
| `notice-attachments` | Private/scoped | Future attachments |

## Security Rules

- Validate file type and size.
- Use private buckets for sensitive files.
- Use signed URLs for downloads.
- Scope files by `organization_id`.
- Audit document verification and deletion.

## TODO Placeholders

- TODO: Define max file sizes.
- TODO: Define allowed MIME types.
- TODO: Define storage path convention.
- TODO: Define virus scanning needs.
- TODO: Define signed URL expiry.

## Future Scalability Notes

- Add image transformations.
- Add CDN strategy for public gallery.
- Add malware scanning if required.
- Add file lifecycle cleanup jobs.

