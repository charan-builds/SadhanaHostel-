# Production Disaster Recovery Signoff

Date: 2026-06-05 UTC

Scope: Sadhana Boys Hostel Supabase PostgreSQL, Supabase Auth evidence, Supabase Storage, PITR/add-on enablement attempt, and isolated restore-target validation.

## Executive Summary

Verdict: NO-GO.

Production data parity remains proven for the required database tables and storage buckets against the isolated restore target. Storage signed URL access was validated for invoice PDFs, payment screenshots, QR codes, and gallery images.

The DR signoff still cannot be approved because Supabase backup metadata reports PITR disabled and no listed physical backups. The attempt to enable the minimum required add-ons failed because the organization is on the Free plan and is not entitled to PITR. A catastrophic-loss recovery cannot be signed off without a real managed backup or PITR recovery point, even though the current isolated target validates cleanly.

## Evidence

Commands executed:

```bash
supabase backups list --project-ref mcooiwyerrmeixdtykpj --output json
npm run recovery:production-evidence
npm run recovery:restore-validation
npm run recovery:storage-validation
```

Additional evidence:

- `DATABASE_URL` points to production Supabase project `mcooiwyerrmeixdtykpj`.
- `RESTORE_DATABASE_URL` points to isolated local Supabase target `127.0.0.1:54322`.
- Supabase Management API project evidence: organization `vscwapdjtrtjeaxdxtoo`, organization plan `free`, project status `ACTIVE_HEALTHY`, database version `17.6.1.121`.
- Direct PostgreSQL access to `DATABASE_URL` from this environment failed with IPv6 `ENETUNREACH`.
- Standard Supabase pooler endpoint was tested and did not expose a usable tenant for this project.
- Source reads used Supabase service-role API access.
- Restore validation used the isolated restore target only.
- Existing isolated restore target contains 49 restored storage objects: 14 payment screenshots, 2 payment QR codes, 12 invoices, and 21 gallery images.
- PITR enablement attempt:
  - `PATCH /v1/projects/mcooiwyerrmeixdtykpj/billing/addons` with `compute_instance/ci_small` returned `400`: `Project addons cannot be edited on the free tier.`
  - `PATCH /v1/projects/mcooiwyerrmeixdtykpj/billing/addons` with `pitr/pitr_7` returned `400`: `Organization is not entitled to the selected PITR duration.`
- Restore-point creation attempt:
  - `POST /v1/projects/mcooiwyerrmeixdtykpj/database/backups/restore-point` returned `400`: `This endpoint is unavailable at the moment`.
- Backup schedule evidence:
  - `GET /v1/projects/mcooiwyerrmeixdtykpj/database/backups/schedule` returned `402`: `This feature requires the Enterprise organization plan.`
- Entitlement evidence:
  - `pitr.available_variants`: `hasAccess=false`, enabled `false`, set `[]`.
  - `backup.retention_days`: `hasAccess=false`, enabled `false`, value `0`.
  - `backup.schedule`: `hasAccess=false`, enabled `false`.
  - `backup.restore_to_new_project`: `hasAccess=false`, enabled `false`.

Supabase backup metadata:

| Field | Value |
| --- | --- |
| projectRef | `mcooiwyerrmeixdtykpj` |
| region | `ap-south-1` |
| pitr_enabled | `false` |
| backups | `[]` |
| walg_enabled | `true` |
| backup metadata duration | 1049 ms |
| backup frequency | unverified |
| retention policy | unverified |

## Counts

Required database table parity:

| Table | Source rows | Restore rows | Status |
| --- | ---: | ---: | --- |
| organizations | 1 | 1 | pass |
| hostels | 1 | 1 | pass |
| residents | 3 | 3 | pass |
| monthly_fee_records | 11 | 11 | pass |
| invoices | 12 | 12 | pass |
| payments | 14 | 14 | pass |
| documents | 47 | 47 | pass |

RPO row loss: 0.

## Storage Validation

Required storage parity and signed URL validation:

| Bucket | Source objects | Restore objects | Signed URL accessible | Content type sampled | Status |
| --- | ---: | ---: | --- | --- | --- |
| payment-screenshots | 14 | 14 | yes | image/png | pass |
| payment-qr-codes | 2 | 2 | yes | image/jpeg | pass |
| invoices | 12 | 12 | yes | application/pdf | pass |
| gallery-images | 21 | 21 | yes | image/jpeg | pass |

Additional bucket checked by recovery scripts:

| Bucket | Source objects | Restore objects | Status |
| --- | ---: | ---: | --- |
| resident-documents | 0 | 0 | pass |

Storage validation duration: 3012 ms.

RPO object loss: 0.

## Finance Validation

Source and restore finance reconciliation counters:

| Counter | Source | Restore | Status |
| --- | ---: | ---: | --- |
| verified_payments_missing_invoice | 0 | 0 | pass |
| verified_payments_missing_receipt | 0 | 0 | pass |
| paid_zero_balance_fee_records_missing_invoice | 0 | 0 | pass |
| paid_invoice_payment_total_mismatch | 0 | 0 | pass |
| verified_receipt_documents_missing_invoice_link | 0 | 0 | pass |

Restore integrity checks:

| Check | Result |
| --- | --- |
| no payments outside resident tenant | pass |
| no invoices outside resident tenant | pass |
| financial balances are non-negative | pass |
| verified payments have verifier and timestamp | pass |
| no orphan audit actors | pass |
| resident auth links resolve to public users | pass |
| no duplicate active resident phone identities | pass |
| private storage buckets remain private | pass |
| expected storage buckets exist | pass |
| document storage objects exist | pass |
| invoice PDF storage objects exist | pass |
| payment screenshot storage objects exist | pass |

## RTO

Measured components:

| Component | Duration |
| --- | ---: |
| backup metadata collection | 1049 ms |
| restore database validation | 50 ms |
| storage validation | 3012 ms |
| full production evidence collection | 4115 ms |

Accepted production RTO: not proven.

Reason: no real Supabase physical backup or PITR restore point exists to measure full catastrophic restore time. The local isolated target validates, but it is not proven to have been created from a current managed backup source.

## RPO

Measured parity against the isolated restore target:

| Area | Loss |
| --- | ---: |
| required database rows | 0 |
| required storage objects | 0 |

Accepted production RPO: not proven.

Reason: PITR is disabled and no managed backup is listed, so recoverability after catastrophic loss is not guaranteed.

## Blockers

| Blocker | Evidence | Required action |
| --- | --- | --- |
| PITR disabled | Supabase backup metadata reports `pitr_enabled=false`. | Enable PITR for production from Supabase Dashboard > Database > Backups. |
| No listed physical backups | Supabase backup metadata returned `backups=[]`. | Ensure at least one physical backup or PITR recovery window is visible and restorable. |
| PITR cannot be enabled on current plan | Applying `ci_small` returned `Project addons cannot be edited on the free tier`; applying `pitr_7` returned `Organization is not entitled to the selected PITR duration`. | Upgrade the organization to a paid plan that permits compute add-ons and PITR, then apply at least `ci_small` and `pitr_7`. |
| Backup retention unavailable | Organization entitlements report `backup.retention_days` disabled with value `0`. | Use a plan/add-on that provides backup retention. |
| Backup schedule unavailable | `GET /database/backups/schedule` returned `402`, and entitlement `backup.schedule` is disabled. | Use an Enterprise plan if scheduled backup time control is required, or rely on PITR/daily backup metadata where available. |
| Fresh managed-backup DB restore not proven | No Supabase backup/PITR recovery point exists, and direct source PostgreSQL dump from this environment is blocked by IPv6-only direct DB host. | Restore from a real Supabase backup/PITR point into an isolated hosted project and rerun evidence. |

## GO / NO-GO

NO-GO.

Do not mark production DR as GO until:

- The organization is upgraded to a plan/add-on combination that provides PITR or physical backups.
- PITR is enabled or a listed physical backup is available.
- A fresh database restore from that backup/PITR point is completed into an isolated target.
- `npm run recovery:production-evidence`, `npm run recovery:restore-validation`, and `npm run recovery:storage-validation` all pass without blockers.
