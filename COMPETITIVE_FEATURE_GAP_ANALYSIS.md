# Competitive Feature Gap Analysis

Date: 2026-06-07

Mode: market/product analysis artifact only. No source files were modified.

## Research Basis

This analysis uses current public competitor/source pages available during the audit:

- MY PG: https://www.manageyourpg.com/
- PGHub: https://www.pghub.in/
- RentKollect: https://rentkollect.com/
- FretBox: https://www.fretbox.in/features.html
- SpaceBasic complaint management: https://www.spacebasic.com/hostel-management-system/complaint-management
- SpaceBasic campus platform: https://www.spacebasic.com/campus
- CampusNest by Trixno: https://www.trixno.com/campusnest
- HabitatIQ: https://habitatiq.app/

## Market Pattern Summary

Leading hostel/PG/student accommodation tools compete on:

- Room/bed and tenant lifecycle.
- Rent/fee collection, reminders, invoices, receipts.
- Digital KYC/document storage.
- Attendance, gate pass, late entry, visitor tracking.
- Complaint/maintenance lifecycle with assignment and status tracking.
- Mess/food planning and feedback.
- Resident mobile app/portal.
- Multi-property operations.
- Owner analytics and reports.
- WhatsApp-first communication or daily digest.
- Automation and AI assistant positioning.

Sadhana Hostel is strong in payments, resident lifecycle, notices backend, analytics backend, support recovery, reports, DR, and launch hardening. It is weaker on attendance/gate/security, full complaint lifecycle, mess/food operations, owner daily digest, and mobile admin ergonomics.

## Must Have

### Attendance, Gate Pass, And Late Return Tracking

- Competitor signal: FretBox, SpaceBasic, and CampusNest all emphasize attendance, biometric/RFID/QR, gate pass, leave, late entry, and safety workflows.
- Sadhana gap: Leave exists, but attendance/gate pass does not appear as a first-class module.
- Recommendation: Add manual v1 attendance first, then QR/gate pass, then device integrations.
- Business value: Safety, parent trust, operational differentiation.

### Full Complaint And Maintenance Lifecycle

- Competitor signal: SpaceBasic highlights complaint submission, automated assignment, real-time tracking, image attachments, notifications, analytics, and feedback.
- Sadhana gap: Resident support exists, but it is not yet a maintenance board with SLA, assignee, photo proof, staff workflow, and feedback.
- Recommendation: Upgrade support into complaint/maintenance lifecycle.
- Business value: Reduces WhatsApp chaos and proves service quality.

### Multi-Property / Multi-Hostel Owner View

- Competitor signal: MY PG, PGHub, GharDesk-like tools, and CampusNest emphasize multi-property/multi-branch operations.
- Sadhana gap: Multi-tenant model exists, but launch UX is single-hostel-first.
- Recommendation: Build owner portfolio mode after single-hostel UX is stable.
- Business value: Unlocks 10->100 customer expansion.

### Digital KYC And Document Checklist

- Competitor signal: MY PG and PGHub call out digital KYC/document onboarding.
- Sadhana gap: Documents exist, but resident-facing checklist and admin review UX can be stronger.
- Recommendation: Add document completion checklist and admin verification queue.
- Business value: Faster onboarding and better compliance.

### Owner Action Queue And Daily Digest

- Competitor signal: RentKollect emphasizes WhatsApp-first commands and daily digest; PG tools emphasize owner simplicity.
- Sadhana gap: Dashboards show data but not daily ranked actions/digest.
- Recommendation: Add owner daily digest and dashboard "today needs attention".
- Business value: Improves retention because owners see value every morning.

## Should Have

### Mess/Food Menu And Feedback

- Competitor signal: FretBox, SpaceBasic, CampusNest, MY PG mention food/mess planning or feedback.
- Sadhana gap: No first-class mess/menu module.
- Recommendation: Start with menu publishing and resident feedback; later add meal attendance/counts.

### Visitor Management

- Competitor signal: SpaceBasic and CampusNest mention visitor logs/approvals.
- Sadhana gap: Not present as first-class module.
- Recommendation: Add visitor log, ID proof, host resident, check-in/out, approval.

### Expense Tracking And P&L

- Competitor signal: MY PG and RentKollect emphasize expense tracking and P&L.
- Sadhana gap: Finance focuses collections/payments, not owner expense/P&L.
- Recommendation: Add simple expense ledger and owner P&L report.

### WhatsApp-First Owner/Admin Actions

- Competitor signal: RentKollect positions plain-language WhatsApp as the interface.
- Sadhana gap: WhatsApp links/templates exist, but owner/admin actions remain dashboard-first.
- Recommendation: Add daily digest and action links before attempting full WhatsApp assistant.

### Feedback, Polls, And Surveys

- Competitor signal: FretBox promotes feedback/polling.
- Sadhana gap: Notices exist but not bidirectional engagement.
- Recommendation: Add polls and post-resolution feedback.

## Nice To Have

### AI Assistant

- Competitor signal: RentKollect and newer hostel systems use AI assistant positioning.
- Recommendation: Defer until workflows and data quality are stable.

### Biometric Device Integration

- Competitor signal: FretBox/CampusNest emphasize biometric tracking.
- Recommendation: Defer until manual attendance/gate-pass proves workflow demand.

### Parent/Guardian Portal

- Competitor signal: education hostel platforms emphasize parent communication.
- Recommendation: Add notification-only guardian updates before full portal.

### Roommate Matching

- Competitor signal: student housing systems mention advanced allocation/matching.
- Recommendation: Useful for institutional hostels; not critical for initial PG/hostel SaaS.

## Competitive Positioning

Sadhana should not try to beat enterprise campus systems immediately. The strongest wedge is:

"A mobile-first, finance-safe hostel/PG management SaaS for Indian hostel owners who need payments, resident lifecycle, reminders, notices, complaints, and reports without ERP complexity."

## Gap Priority Table

| Gap | Rank | Why |
|---|---:|---|
| Attendance/gate pass | Must Have | Safety and daily operations |
| Complaint/maintenance lifecycle | Must Have | Resident satisfaction and operational proof |
| Owner action queue/digest | Must Have | Retention and habit formation |
| Digital KYC checklist | Must Have | Onboarding/compliance |
| Multi-property owner view | Must Have | Scaling beyond first customers |
| Mess/menu feedback | Should Have | Common hostel expectation |
| Visitor management | Should Have | Safety/compliance |
| Expense/P&L | Should Have | Owner business control |
| WhatsApp-first actions | Should Have | India owner workflow fit |
| Polls/surveys | Nice To Have | Engagement layer |
| AI assistant | Nice To Have | Differentiator after data maturity |
| Biometric integration | Nice To Have | Enterprise/institutional tier |

## Final Recommendation

Build the next product cycle around attendance/gate-pass, complaint lifecycle, owner daily action queue, resident payment polish, and document/KYC checklist. These close the biggest competitive gaps while preserving the product's existing backend strength.
