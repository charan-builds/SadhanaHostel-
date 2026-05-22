# Operational UAT Matrix

Project: Sadhana Boys Hostel Platform  
Phase: soft-launch operational validation  
Owner: release QA / hostel operations lead  
Result standard: every critical workflow must be executed against staging with seeded but realistic data.

## Test Data Gate

Before UAT, staging must contain:

- 1 owner/admin, 1 finance user, 1 receptionist or warden, and 2 resident users.
- 100+ resident records across active, pending onboarding, suspended, and exited states.
- 30+ rooms with active, full, partially vacant, reserved, and maintenance-blocked examples.
- Leads in `new_inquiry`, `called`, `interested`, `reserved`, `cancelled`, and `joined`.
- Reservations in `pending`, `reserved`, `confirmed`, `expired`, and `converted_to_resident`.
- Manual UPI payments in pending, rejected, verified, duplicate-attempt, and proof-missing scenarios.
- CMS settings, facilities, gallery images, notices, and payment QR configuration.

## Severity Model

| Severity | Definition | Launch Decision |
| --- | --- | --- |
| Critical | Data leakage, auth bypass, overbooking, duplicate invoice/payment, corrupted onboarding, or production boot failure. | No-go |
| High | Workflow cannot be completed by the intended role or creates manual Supabase dependency. | No-go until fixed or operationally mitigated |
| Medium | Usability or recovery friction that slows staff but has a workaround. | Soft-launch acceptable with owner sign-off |
| Low | Copy, polish, or minor layout issue without workflow impact. | Track post-launch |

## Public User Flows

| ID | Scenario | Steps | Expected Result | Severity |
| --- | --- | --- | --- | --- |
| PUB-01 | Vacancy browsing | Open home, rooms, facilities, gallery, contact on mobile and desktop. | Pages render without runtime errors; vacancy/CTA information is visible or gracefully falls back. | High |
| PUB-02 | Inquiry submission | Submit website inquiry with valid name, phone, date, source, and notes. | Lead is created once, admin sees inquiry, public user sees non-technical confirmation. | High |
| PUB-03 | Inquiry abuse | Submit duplicate phone rapidly, honeypot field, oversized notes, invalid phone. | Rate limit/validation blocks abuse without creating duplicate operational leads. | Critical |
| PUB-04 | Reservation request path | Inquiry becomes lead, admin contacts, reservation is created. | Vacancy decreases through reserved count, not occupied count. | Critical |

## Resident Flows

| ID | Scenario | Steps | Expected Result | Severity |
| --- | --- | --- | --- | --- |
| RES-01 | Invite activation | Open valid invite, confirm identity, set password. | Auth user links to resident once; invite cannot be reused. | Critical |
| RES-02 | Onboarding required | Login before verification and open payments/dashboard/leave. | Redirected to onboarding; restricted areas stay blocked. | Critical |
| RES-03 | Profile completion | Enter profile, guardian, emergency, address, college/course details. | Progress persists after refresh and resumes after logout/login. | High |
| RES-04 | Document upload | Upload Aadhaar, photo, student ID from mobile. | File validation, retry, preview, and pending verification work. | High |
| RES-05 | Rejected onboarding | Admin rejects document with note; resident re-uploads. | Resident sees actionable reason and can retry only the rejected section. | High |
| RES-06 | Payment proof | View dues, scan QR, enter UTR, upload screenshot. | Payment becomes pending; duplicate UTR/proof attempts are rejected. | Critical |
| RES-07 | Invoice download | After finance verification, open invoice. | Signed invoice URL opens for own invoice only. | Critical |
| RES-08 | Leave request | Submit leave with dates, reason, travel mode. | Leave is pending, then realtime status updates after admin action. | Medium |

## Admin Operations Flows

| ID | Scenario | Steps | Expected Result | Severity |
| --- | --- | --- | --- | --- |
| ADM-01 | Fresh setup | Owner opens `/admin/setup` and completes organization, hostel, rooms, payment, facilities. | No Supabase dashboard setup is required. | Critical |
| ADM-02 | Hostel management | Create/edit/deactivate hostel and capacity. | Capacity and active hostel scope update safely. | High |
| ADM-03 | Room and bed management | Create room, update bed count, mark maintenance. | Vacancy reflects room changes immediately and prevents invalid allocations. | Critical |
| ADM-04 | Lead management | Create lead, add notes, schedule follow-up, reserve. | Activity timeline and status are accurate. | High |
| ADM-05 | Reservation conversion | Confirm reservation, send invite, activate resident, allocate room. | Payment history/notes preserve and reservation cannot overbook. | Critical |
| ADM-06 | Verification queue | Approve/reject resident documents with notes. | Resident access state changes only through valid transitions. | Critical |
| ADM-07 | CMS management | Edit hero/about/facilities/gallery/notices. | Public site updates after cache invalidation without DB manual edits. | High |
| ADM-08 | Staff access | Create finance user, receptionist, warden; revoke/suspend/reset. | Role restrictions apply immediately; final owner/admin cannot be removed. | Critical |

## Finance Flows

| ID | Scenario | Steps | Expected Result | Severity |
| --- | --- | --- | --- | --- |
| FIN-01 | QR rotation | Upload new QR, update UPI ID/account holder, save. | Old config remains in history; residents see current signed QR. | Critical |
| FIN-02 | Payment queue | Open pending payment, preview proof, compare UTR, approve. | Payment verifies atomically; invoice is generated once; audit log records actor. | Critical |
| FIN-03 | Rejection | Reject invalid proof with reason. | Resident receives rejected status and can resubmit safely. | High |
| FIN-04 | Duplicate UTR | Submit same UTR from another resident/payment. | Duplicate is rejected before verification and cannot create invoice. | Critical |
| FIN-05 | Partial/advance controls | Toggle payment rules and submit edge amounts. | Configured minimum/partial/advance rules are enforced. | High |

## Staff Role Flows

| ID | Role | Allowed | Blocked | Severity |
| --- | --- | --- | --- | --- |
| STF-01 | Finance | Payment queue, payment reports, invoice audit. | Staff management, payment security if not admin/owner, CMS if not granted. | Critical |
| STF-02 | Receptionist | Leads, reservations, resident intake. | Payment verification, analytics, staff management. | Critical |
| STF-03 | Warden | Rooms, leaves, notices, resident operations. | Finance configuration, owner/admin management. | Critical |
| STF-04 | Suspended staff | No portal access. | All protected routes and APIs. | Critical |

## Failure Simulation Matrix

| ID | Failure | Simulation | Expected Recovery |
| --- | --- | --- | --- |
| FAIL-01 | Supabase read failure | Break staging DB URL in preview env or run controlled outage window. | `/api/health/ready` degraded, UI shows retry guidance, no data mutation occurs. |
| FAIL-02 | Storage failure | Use invalid bucket in staging only. | Upload fails with operational guidance; no orphan DB record. |
| FAIL-03 | Realtime disconnect | Browser devtools offline/online, throttled network. | Reconnect notice or stale-safe refetch; no duplicated notifications. |
| FAIL-04 | Expired session | Expire cookies or logout in another tab. | Protected routes redirect cleanly; no protected UI flash. |
| FAIL-05 | Interrupted onboarding | Refresh mid-upload and logout mid-step. | Draft state resumes or clearly asks user to retry without duplicate documents. |
| FAIL-06 | Concurrent reservation | Two admins reserve final bed simultaneously. | One succeeds; one receives capacity-safe error; vacancy remains correct. |
| FAIL-07 | Concurrent payment verification | Two finance users approve same payment. | One succeeds; one gets immutable/verified state error; one invoice exists. |

## Automated Gates

Run locally before staging sign-off:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run test:smoke
```

Run against staging with real credentials:

```bash
E2E_AUTH_RUN_REAL_FLOWS=true \
E2E_OPERATIONAL_UAT_RUN_MUTATIONS=true \
E2E_ADMIN_EMAIL=admin@example.com \
E2E_ADMIN_PASSWORD='replace-me' \
E2E_RESIDENT_EMAIL=resident@example.com \
E2E_RESIDENT_PASSWORD='replace-me' \
npm run test:smoke
```

Run staging load validation:

```bash
LOAD_TEST_BASE_URL=https://staging.example.com \
LOAD_TEST_ORGANIZATION_ID=<org-id> \
LOAD_TEST_HOSTEL_ID=<hostel-id> \
LOAD_TEST_RESIDENT_ID=<resident-id> \
LOAD_TEST_ADMIN_EMAIL=admin@example.com \
LOAD_TEST_ADMIN_PASSWORD='replace-me' \
LOAD_TEST_RESIDENT_EMAIL=resident@example.com \
LOAD_TEST_RESIDENT_PASSWORD='replace-me' \
npm run load:k6
```

## Sign-Off

| Area | Owner | Status | Evidence Link | Notes |
| --- | --- | --- | --- | --- |
| Public website | QA | TODO | TODO | TODO |
| Resident portal | QA | TODO | TODO | TODO |
| Admin operations | Operations | TODO | TODO | TODO |
| Finance controls | Finance | TODO | TODO | TODO |
| IAM/staff access | Owner | TODO | TODO | TODO |
| Security/RLS/storage | Security | TODO | TODO | TODO |
| Load/performance | Release | TODO | TODO | TODO |
