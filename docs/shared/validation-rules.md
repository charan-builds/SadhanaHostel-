# Validation Rules

## Purpose

Define shared validation rules so frontend UX validation and backend authoritative validation stay aligned.

## Scope

Covers validation for:

- Residents.
- Rooms.
- Payments.
- Leaves.
- Notices.
- Notifications.
- CMS.
- Uploads.
- Environment configuration.

## Responsibilities

Frontend responsibilities:

- Provide immediate validation feedback.
- Prevent obvious invalid submissions.

Backend responsibilities:

- Enforce all validation.
- Enforce business rules.
- Return typed field errors.

## Architecture Overview

```txt
Shared Zod schema
  -> frontend form validation
  -> backend server validation
  -> typed field errors
```

## Validation Rule Examples

| Domain | Rule |
| --- | --- |
| Resident | Full name required |
| Resident | Admission number unique per hostel |
| Room | Capacity must be positive |
| Payment | Amount must be positive |
| Payment | Offline payment requires mode and received date |
| Leave | `toDate` must be after or equal to `fromDate` |
| Leave | Overlapping active requests not allowed |
| Notice | Title and body required before publish |
| CMS | Published page requires SEO title and slug |
| Upload | File type and size must be allowed |

## Example Zod Placeholder

```ts
import { z } from "zod"

export const createLeaveRequestSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
  reason: z.string().min(5).max(500),
  destination: z.string().max(200).optional(),
})
```

## Error Shape

```ts
type FieldErrors = Record<string, string[]>
```

## Security Validation

- Server must verify tenant scope.
- Server must verify role permissions.
- Server must verify record ownership.
- File uploads must validate MIME type and size server-side.
- Payment values must be recalculated server-side.

## TODO Placeholders

- TODO: Create shared schema folder.
- TODO: Define phone validation.
- TODO: Define date parsing strategy.
- TODO: Define money precision rules.
- TODO: Define file upload constraints.
- TODO: Define CMS rich text validation.

## Future Scalability Notes

- Add localization for validation messages.
- Add schema-derived form helpers.
- Add validation contract tests between frontend and backend.

