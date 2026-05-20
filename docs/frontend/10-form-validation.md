# Form Validation

## Purpose

Define frontend form validation standards and alignment with backend validation for production workflows.

## Scope

Forms covered:

- Contact inquiry.
- Resident creation/edit.
- Room creation/edit.
- Payment recording.
- Leave request.
- Notice creation.
- CMS editing.
- Settings and integration forms.

## Responsibilities

Frontend owns:

- Form layout.
- Client-side validation feedback.
- Pending/success/error states.

Backend owns:

- Authoritative validation.
- Business rule validation.
- Persistence and audit logs.

## Architecture Overview

```txt
React Hook Form
  -> Zod schema
  -> client validation
  -> server action
  -> server validation
  -> mutation
  -> typed result
```

## Validation Rules

- Required fields must be explicit.
- Dates must be validated for order and overlap.
- Payment amounts must be positive and server-verified.
- Phone/email formats must be validated but not over-restricted.
- File upload types and sizes must be validated before upload and server-side.

## Error Display

| Error Type | UI Pattern |
| --- | --- |
| Field error | Inline below field |
| Form error | Alert near submit |
| Permission error | Page-level or toast |
| Server conflict | Specific message with next action |
| Provider error | Friendly retry guidance |

## TODO Placeholders

- TODO: Define shared Zod schemas.
- TODO: Define form error component.
- TODO: Define phone number validation policy.
- TODO: Define date validation helpers.
- TODO: Define file validation rules.

## Future Scalability Notes

- Generate forms from schema only if repetition becomes high.
- Add localization for validation messages.
- Add approval workflows for sensitive profile edits.

