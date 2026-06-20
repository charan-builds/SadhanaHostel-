# Resident Admission, Leave, and Password Fix Report

## Scope

Implemented only the requested leave, admission-number, and password-policy changes. No migrations, dependency changes, environment changes, package changes, payment/invoice/finance/notification/WhatsApp/report/automation logic, CMS, homepage, header, or rules page changes were made for this task.

## Change 1: Leave Request Destination Removed

- Removed the `Destination` field from the resident leave request form.
- Removed `destination` from the resident leave form default values and submit payload.
- Existing leave records and approval/rejection flow remain untouched.
- Server-side leave schema still tolerates existing destination data for old records.

## Change 2: Active Resident Draft Admission Numbers

- Added a resident repository guard that upgrades only active residents whose admission number starts with `DRAFT-`.
- Draft and invited residents keep their draft admission numbers.
- Permanent numbers use the existing application style: `ADM-YYYYMMDD-XXXXXXXX`.
- The upgrade is lazy and automatic when active resident records are returned by the resident repository or when self-onboarding/verification transitions return an active resident.
- Linked resident data, payments, allocations, and history are not recreated or detached.

## Change 3: Password Policy Updated

- New resident activation password validation now accepts a minimum of 8 characters.
- Invite activation API validation now accepts a minimum of 8 characters.
- Temporary-password replacement / password update validation now accepts a minimum of 8 characters.
- Existing accounts and existing passwords are unchanged.
- No forced password reset or password migration was added.

## Validation

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

Note: A corrupted generated Next.js cache under `.next/dev/types` was cleared before rerunning typecheck. No source, config, package, environment, or backend schema files were changed for that cleanup.
