# Invoice System

## Purpose

Define backend invoice generation, numbering, PDF storage, receipt linkage, and lifecycle management.

## Scope

Covers:

- Invoice creation.
- Invoice line items.
- Monthly invoice generation.
- PDF rendering/storage.
- Receipt generation.
- Cancellation and audit logs.

## Responsibilities

Backend owns:

- Invoice numbering.
- Financial calculations.
- PDF generation.
- Storage path security.
- Audit trail.

Frontend owns:

- Invoice display and download UI.

## Architecture Overview

```txt
Fee record
  -> invoice generation service
  -> line items
  -> invoice number
  -> PDF generation
  -> storage upload
  -> resident notification
```

## Invoice Entities

| Entity | Purpose |
| --- | --- |
| `invoices` | Invoice header |
| `invoice_line_items` | Charges, discounts, taxes |
| `payments` | Linked collections |
| `documents` or storage file | PDF file reference |

## Numbering Placeholder

```txt
SBH/{HOSTEL_CODE}/{YYYY}/{SEQUENCE}
Example: SBH/MH01/2026/000123
```

## PDF Requirements

- Organization and hostel details.
- Resident details.
- Invoice number and issue date.
- Line items.
- Total and paid status.
- Payment instructions.
- Footer terms.

## TODO Placeholders

- TODO: Select PDF rendering approach.
- TODO: Define invoice line item schema.
- TODO: Define receipt vs invoice relationship.
- TODO: Define cancellation rules.
- TODO: Define PDF storage bucket.

## Future Scalability Notes

- Add tax/GST fields if required.
- Add bulk monthly invoice jobs.
- Add invoice email delivery.
- Add accounting exports.

