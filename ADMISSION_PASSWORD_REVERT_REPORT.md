# Admission Number and Password Policy Revert Report

## Scope

Reverted only the recent admission-number standardization and password-policy relaxation changes. No payment, invoice, receipt, finance, notification, WhatsApp, analytics, report, leave, room, bed, CMS, homepage, dependency, package, build configuration, environment, role, or permission changes were made for this revert.

## Admission Number Revert

- Removed the application-side SDH admission number assignment path from the residents repository.
- Restored resident repository reads/writes to return resident records without admission-number mutation.
- Removed the `20260619080000_admission_number_standardization.sql` migration file.
- Added a no-data-loss cleanup migration:
  - Drops the SDH admission number trigger if present.
  - Drops SDH admission number RPC functions if present.
  - Drops the SDH admission number unique index if present.
  - Drops the admission number counter table if present.
- The cleanup migration intentionally does not update resident rows or rewrite admission numbers.

## Password Policy Revert

- Restored invite activation password validation to 12 characters minimum.
- Restored strong password validation to:
  - 12+ characters
  - uppercase letter
  - lowercase letter
  - number
  - symbol
- Restored activation page password validation text to 12 characters.
- Restored password update requirement checklist to the previous full strong-password checklist.

## Validation

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
