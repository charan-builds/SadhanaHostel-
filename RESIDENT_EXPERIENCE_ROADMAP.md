# Resident Experience Roadmap

Date: 2026-06-07

Mode: product roadmap artifact only. No source files were modified.

## Product Goal

Make the resident portal the place where a resident can answer three questions quickly:

1. What do I need to do now?
2. What is my hostel/payment/room status?
3. How do I get help without calling repeatedly?

## Current Strengths

- Resident dashboard has profile, payable, advance, leave, notice, and quick-action cards.
- Resident payments support UPI reference, QR/app links, proof upload, partial/advance logic, invoice downloads, and support.
- Resident support covers payment, maintenance, safety, lost/found, room, account, upload, and onboarding categories.
- Resident notices have search, pagination, pinned indicators, and active notice filtering.
- Resident profile has editable contact/family details and room enrichment from backend work.

## Gaps

- No strong next-best-action engine on resident dashboard.
- Payment flow is functionally rich but cognitively long.
- Complaints are support requests, not a full maintenance/status/feedback experience.
- No attendance/gate-pass presence flow.
- Room details are present in profile data but not yet a rich resident room experience.
- No resident engagement loops: polls, feedback, mess menu, safety updates, roommate/room rules.

## Quick Wins

| Item | Impact | Effort | Notes |
|---|---:|---:|---|
| Add resident dashboard "Action needed" card | High | S | Priority: payment due, pending proof, profile incomplete, urgent notice, active support response |
| Add payment stepper | High | M | Pay by UPI -> upload proof -> wait for verification |
| Add "What happens next" after payment submission | Medium | S | Persistent inline state, not just toast |
| Add notice acknowledgement/read status in resident notices | Medium | S | Use backend read/ack support |
| Add support request timeline | Medium | M | Submitted, assigned, in progress, resolved |
| Add room summary card on dashboard | Medium | S | Room number/name, allocation since, support CTA |
| Add profile completion score | Medium | S | Contact, family phone, address, documents |
| Add clearer login recovery links | Medium | S | Resident reset/support path on auth errors |

## 30-Day Improvements

| Item | Impact | Effort | Dependencies |
|---|---:|---:|---|
| Maintenance complaint lifecycle | High | M | Support request board, assignee/status/SLA fields |
| Payment reminder center | High | M | Smart notifications and payment reminder backend |
| Resident notification center | High | M | Smart notifications, archive, read state |
| Room details page | Medium | M | Resident room enrichment, room rules/content |
| Leave request improvements | Medium | M | Parent/guardian notification if needed |
| Document checklist | High | M | Current upload/document metadata |
| Resident feedback after support resolution | Medium | M | Support lifecycle |
| WhatsApp deep links for support/payment | Medium | S | Existing WhatsApp helpers |

## 90-Day Improvements

| Item | Impact | Effort | Dependencies |
|---|---:|---:|---|
| Attendance/gate-pass resident flow | High | L | Attendance/gate-pass backend and admin workflows |
| Mess menu and food feedback | Medium | L | New mess/menu model |
| Resident polls/surveys | Medium | M | Notification and feedback model |
| Parent/guardian communication portal | High | L | Auth/permissions and notification templates |
| Roommate/room issue workflow | Medium | M | Complaint categories and room data |
| Smart assistant for resident help | Medium | L | FAQ/support knowledge base |
| PWA install and push onboarding | Medium | M | Approved service worker registration |
| Resident referral/admission sharing | Medium | M | Public admissions and referral tracking |

## Recommended Resident V2 Information Architecture

- Dashboard
  - Action needed
  - Fees and payment status
  - Room
  - Latest notice
  - Support status
- Payments
  - Pay now
  - Pending verification
  - Receipts/invoices
  - Payment help
- Notices
  - Urgent/pinned
  - Acknowledgement required
  - All notices
- Support
  - Raise issue
  - Track issue
  - Resolved history
- Stay
  - Room details
  - Leave/gate pass
  - Rules and contacts
- Profile
  - Contact info
  - Family/emergency info
  - Documents
  - Account security

## Success Metrics

- Payment submission completion rate.
- Payment support requests per 100 payments.
- Profile completion rate.
- Notice read/acknowledgement rate.
- Support request time to resolution.
- Resident active usage per week.
- Login recovery requests per 100 residents.

## Final Recommendation

Prioritize resident payments, action-needed dashboard, support timeline, and notice acknowledgements first. Attendance/gate-pass and parent communication are the highest-value 90-day upgrades.
