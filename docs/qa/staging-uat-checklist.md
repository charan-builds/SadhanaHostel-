# Staging UAT Checklist

## Purpose

Validate real hostel workflows with staging users before production launch.

## Test Data Requirements

- At least 100 residents.
- At least 30 rooms with realistic occupancy.
- At least 6 months of payment history.
- Pending and verified payments.
- Generated invoices.
- Pending, approved, and rejected leave requests.
- Active notices and CMS content.

Seed staging:

```bash
npm run staging:seed
```

## Resident Workflow

| Step | Action | Expected Result | Status |
| --- | --- | --- | --- |
| 1 | Resident logs in | Redirects to `/resident/dashboard` | TODO |
| 2 | Opens profile | Own details only are visible | TODO |
| 3 | Uploads profile photo | Upload completes, preview updates | TODO |
| 4 | Uploads Aadhaar document | Private document metadata created | TODO |
| 5 | Opens payments | Pending dues and history load | TODO |
| 6 | Submits UPI reference without proof | Submission blocked | TODO |
| 7 | Submits UPI reference with proof | Payment is pending verification | TODO |
| 8 | Waits for admin verification | Realtime/status refresh updates | TODO |
| 9 | Downloads invoice | Signed invoice URL opens | TODO |
| 10 | Applies leave | Leave request appears as pending | TODO |
| 11 | Views notices | Active notices visible | TODO |

## Admin Workflow

| Step | Action | Expected Result | Status |
| --- | --- | --- | --- |
| 1 | Admin logs in | Redirects to `/admin/dashboard` | TODO |
| 2 | Creates resident | Resident appears in list | TODO |
| 3 | Allocates room | Capacity is respected | TODO |
| 4 | Attempts over-allocation | Operation blocked | TODO |
| 5 | Opens payment queue | Pending proof can be previewed | TODO |
| 6 | Verifies payment without proof | Operation blocked | TODO |
| 7 | Verifies payment with proof | Payment becomes verified | TODO |
| 8 | Generates invoice | One invoice per monthly fee record | TODO |
| 9 | Reviews analytics | Totals match seeded data | TODO |
| 10 | Exports report | CSV/XLS download starts | TODO |
| 11 | Manages CMS | Public website reflects staging content | TODO |
| 12 | Manages notices | Resident portal receives notice update | TODO |

## Acceptance Criteria

- No critical Sentry errors during UAT.
- No tenant data visible across users.
- No payment/invoice duplication.
- Admin can complete resident creation, allocation, payment verification, and reporting.
- Resident can complete payment proof upload, invoice download, and leave application on mobile viewport.
- `/api/health/ready` remains healthy during UAT.

## Sign-Off

| Role | Name | Date | Notes |
| --- | --- | --- | --- |
| Hostel admin user | TODO | TODO | TODO |
| Resident test user | TODO | TODO | TODO |
| QA owner | TODO | TODO | TODO |
| Release owner | TODO | TODO | TODO |
