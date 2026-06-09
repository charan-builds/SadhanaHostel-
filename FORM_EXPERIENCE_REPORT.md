# Form Experience Report

Date: 2026-06-08

Batch: Prompt 9 - Form Experience Upgrade

## Summary

Improved resident leave form validation and error recovery.

The resident leave form already preserved the correct backend submission flow, but field-level validation messages were not fully linked to their inputs and were not announced as field-specific alerts. The form now follows the stronger pattern already used by the public inquiry form.

No APIs, schema, backend behavior, tenant isolation, or leave business rules were changed.

## Files Changed

- `src/components/resident/resident-leave-client.tsx`
- `src/tests/unit/components/form-experience-static.test.ts`
- `FORM_EXPERIENCE_REPORT.md`
- `MASTER_PRODUCT_EVOLUTION_REPORT.md`

## Code Implemented

- Enabled `onBlur` validation mode for the resident leave form.
- Explicitly enabled first-invalid-field focus through `shouldFocusError`.
- Linked date and reason errors to their inputs with `aria-describedby`.
- Added alert-role field error text through `FormErrorText`.
- Added inline guidance for the leave reason field.

## Why This Improves Form UX

- Residents get earlier validation feedback before submit.
- Keyboard users are moved to the first invalid field on failed submit.
- Screen-reader users hear the field-specific error instead of only seeing visual red text.
- The reason field now explains the minimum requirement before the resident hits submit.

## Before / After Behavior

Before:

- Leave validation happened mainly at submit time.
- Field errors were visible but not consistently connected to the relevant input.
- Error text was not announced as a field-level alert.
- Reason-length guidance appeared only after validation failed.

After:

- Validation runs on blur and submit.
- Failed submit focuses the first invalid field.
- Errors are linked through `aria-describedby` and announced with `role="alert"`.
- Reason guidance is visible before the user submits.

## Tests Added

- `src/tests/unit/components/form-experience-static.test.ts`

Coverage includes:

- resident leave form uses `onBlur` validation
- first-invalid-field focus remains enabled
- date and reason field errors are linked through `aria-describedby`
- field errors are announced with `role="alert"`

## Validation Results

Focused test:

```text
npm run test -- src/tests/unit/components/form-experience-static.test.ts
Test Files  1 passed (1)
Tests       1 passed (1)
```

Full gate:

```text
npm run lint
PASS
```

```text
npm run typecheck
PASS
```

```text
npm run test
Test Files  122 passed | 3 skipped (125)
Tests       547 passed | 5 skipped (552)
```

```text
npm run test:security
Test Files  7 passed | 2 skipped (9)
Tests       69 passed | 3 skipped (72)
```

```text
npm run build
PASS
Compiled successfully
Generated static pages using 15 workers (37/37)
```

## Risk Assessment

GO for this form-experience batch.

Risk is low because the change affects only client-side validation presentation and accessibility semantics for an existing form. Submission payloads and backend validation remain unchanged.
