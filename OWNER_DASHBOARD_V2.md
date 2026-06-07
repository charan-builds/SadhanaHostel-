# Owner Dashboard V2

Date: 2026-06-07

Mode: dashboard strategy artifact only. No source files were modified.

## Dashboard Objective

The owner dashboard should answer:

1. Is the hostel healthy today?
2. Where is money stuck?
3. Which residents need action?
4. What changed since yesterday/last week?
5. What can I fix in one click?

## Current Dashboard Baseline

Existing owner/admin analytics already cover revenue, pending dues, resident counts, operational alerts, owner export, communication metrics, and finance dashboard integration. The next improvement is not "more charts"; it is better action prioritization.

## Recommended KPI Hierarchy

### Tier 1: Owner Daily Health

| KPI | Why It Matters | Display |
|---|---|---|
| Cash collected today | Owner checks daily money first | Large card with yesterday comparison |
| Pending collection | Direct risk to revenue | Large warning card with resident count |
| Occupancy / active residents | Core business health | Occupancy percentage plus empty beds |
| Action queue count | Converts dashboard to work | Count by money, profile, support, notice |

### Tier 2: Operational Risk

| KPI | Why It Matters | Display |
|---|---|---|
| Pending payment verification | Money waiting for staff action | Queue with verify CTA |
| Overdue residents | Follow-up target | Sorted resident list |
| Draft/onboarding residents | Revenue activation risk | "Complete activation" CTA |
| Open complaints/support | Service quality risk | Priority and age |
| Pending leave/gate status | Safety/operations risk | Current away/pending count |

### Tier 3: Growth And Retention

| KPI | Why It Matters | Display |
|---|---|---|
| New leads/reservations | Growth pipeline | Funnel widget |
| Notice read/ack rate | Communication effectiveness | Engagement widget |
| Payment reminder performance | Automation ROI | Sent/open/paid-after-reminder |
| Resident churn/checkouts | Retention | Monthly trend |

## Widget Recommendations

### P1: Today Needs Attention

- Contents: pending payment verification, overdue residents, open support, pending activation, urgent notice acknowledgement gaps.
- Behavior: sorted by business impact.
- One-click actions: verify payment, call/WhatsApp resident, resend invite, publish notice, open support request.

### P1: Money Control Center

- Contents: today collected, this month collected, pending dues, overdue by age, payment verification queue.
- Behavior: shows "collectable now" and "blocked by admin action".
- One-click actions: send reminder, verify proof, export dues, open collections page.

### P1: Resident Lifecycle Funnel

- Contents: lead -> reservation -> draft resident -> pending finance -> active -> checked out.
- Behavior: each stage has count and action.
- One-click actions: add resident, confirm reservation, send invite, verify onboarding.

### P1: Communication Health

- Contents: unread notices, unread residents, acknowledgement rate, reminder engagement.
- Behavior: flags notices below read/ack threshold.
- One-click actions: resend reminder, publish follow-up notice, view residents not reached.

### P2: Occupancy And Room Map

- Contents: occupied beds, available beds, blocked rooms, upcoming checkout.
- Behavior: visual floor/room status if data supports it.
- One-click actions: allocate, transfer, mark maintenance, open room detail.

### P2: Owner Export Center

- Contents: common owner reports with date presets.
- Behavior: preview before export.
- One-click actions: download CSV/PDF, WhatsApp summary, email report.

## Automation Recommendations

| Automation | Priority | Trigger | Action |
|---|---:|---|---|
| Payment reminder | P1 | 7 days, 3 days, tomorrow, due, overdue | In-app/WhatsApp reminder |
| Payment verification queue | P1 | New proof upload | Alert admin/owner |
| Invite resend | P1 | Resident inactive after 24h/72h | Suggest resend |
| Notice follow-up | P1 | Low read/ack rate after 24h | Suggest follow-up notice |
| Complaint SLA escalation | P1 | High priority unresolved | Alert owner |
| Daily digest | P2 | 9 AM daily | Send collections, dues, occupancy, open issues |
| Weekly business summary | P2 | Monday morning | Revenue, occupancy, pending dues, churn |

## Mobile Recommendations

- First screen: Today needs attention, cash collected today, pending collection.
- Hide date filters behind filter button.
- Use action cards, not tables.
- Keep "Call/WhatsApp resident" visible in collections/support queues.
- Make export secondary; mobile owner wants decisions first.

## Dashboard V2 Layout

1. Header: hostel/date scope, refresh, export.
2. Today needs attention.
3. Daily health KPI row.
4. Money control center.
5. Resident lifecycle funnel.
6. Communication health.
7. Support/complaint risk.
8. Reports/export center.

## Success Metrics

- Owner daily active usage.
- Percent of overdue residents contacted from dashboard.
- Payment proof verification time.
- Open support issue age.
- Notice acknowledgement rate.
- Export usage by report type.

## Final Recommendation

Build Owner Dashboard V2 around action queues, not charts. The product already has data; the owner needs ranked decisions and one-click actions.
