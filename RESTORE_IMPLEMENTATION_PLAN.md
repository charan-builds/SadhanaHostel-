# UI Restoration Implementation Plan

Date: 2026-06-07

Inputs used:

- `origin/main`
- `ui-recovery`
- `RESTORE_DIFF_REPORT.md`
- `UI_DAMAGE_REPORT.md`
- `git diff --name-status origin/main..ui-recovery`

Objective: restore the original user experience while preserving Notice System, Notice Acknowledgements, Smart Notifications, Push Notifications, PWA infrastructure, Analytics additions, Security fixes, Database migrations, and DR scripts.

No source code should be modified until this plan is approved.

## Summary Decision

- Restore public visual components from `origin/main` where the `ui-recovery` change only removed UI quality.
- Partially restore provider/layout/resident files where `ui-recovery` contains preserved PWA, notice, notification, or analytics behavior.
- Keep backend, database, PWA infrastructure, analytics, security, and DR files from `ui-recovery`.

## A. Restore Completely

These files should be restored from `origin/main` or removed when they did not exist in `origin/main`.

| File | Why it changed | User-facing regression | Notifications/PWA dependency | Exact restore strategy | Risk |
|---|---|---|---|---|---|
| `src/components/public/public-navbar.tsx` | Simplified into a server component for performance. | Translation switcher disappeared; active nav, rich mobile menu trigger, icons, auth actions, and contact analytics disappeared. | No notification/PWA dependency. Has analytics click tracking in origin/main that should be restored. | Restore from `origin/main`. Keep only current `logoUrl` compatibility if needed; origin/main already supports it. | Low |
| `src/components/public/public-mobile-menu.tsx` | Adjusted for lazy/dynamic menu loading. | Rich mobile auth actions were replaced by simpler Resident/Admin buttons; component is no longer rendered by navbar. | No notification/PWA dependency. | Restore from `origin/main` alongside `public-navbar.tsx`. | Low |
| `src/components/public/public-nav-client-controls.tsx` | Added as a dynamic replacement for navbar client controls. | Orphaned component; translation/menu controls never render. | No notification/PWA dependency. | Delete this file unless a later implementation intentionally wires it in with identical UI. | Low |
| `src/components/public/home-highlights.tsx` | Converted to server/static markup. | Framer Motion and lucide icons removed; blank icon blocks appear. | No notification/PWA dependency. | Restore from `origin/main`. | Low |
| `src/components/public/testimonials-section.tsx` | Converted to server/static markup. | Framer Motion, quote icon, and star icons removed. | No notification/PWA dependency. | Restore from `origin/main`. | Low |
| `src/components/public/about-preview.tsx` | Replaced icon/button/link presentation with manual dots/anchors. | Cards look less polished; link/button behavior downgraded. | No notification/PWA dependency. | Restore from `origin/main`. | Low |
| `src/components/public/final-cta.tsx` | Replaced shadcn buttons/icons with manual anchors. | CTA loses icon-rich button presentation. | No notification/PWA dependency. | Restore from `origin/main`. | Low |
| `src/components/public/local-search-links.tsx` | Replaced `next/link` and icons with manual anchors/text arrow. | Local SEO cards lose icon/arrow polish and Next navigation behavior. | No notification/PWA dependency. | Restore from `origin/main`. | Low |
| `src/components/public/location-cta.tsx` | Removed embedded map and icon/button composition. | Location section no longer shows map iframe; visit/directions experience degraded. | No notification/PWA dependency. | Restore from `origin/main`. | Medium, because map iframe may affect performance but it restores original UX. |
| `src/components/public/public-footer.tsx` | Converted client footer to static anchors. | Footer loses icons, buttons, Next links, and contact analytics tracking. | No notification/PWA dependency. Analytics tracking should be restored. | Restore from `origin/main`. | Low |
| `src/components/public/lazy-contact-inquiry-form.tsx` | Added after homepage inquiry form was removed. | Not directly visible if unused, but it reflects the downgraded inquiry flow. | No notification/PWA dependency. | Delete if `inquiry-section.tsx` is restored to inline `ContactInquiryForm` and no references remain. | Low |
| `src/app/(public)/error.tsx` | Replaced shared error UI with manual card. | Error state feels less consistent with product UI. | No notification/PWA dependency. Sentry capture should remain. | Restore origin/main visual `APIErrorState`; optionally keep dynamic Sentry import only if it does not alter UI. | Low |
| `src/app/(public)/loading.tsx` | Replaced shared `LoadingState` with manual skeletons. | Loading screen loses shared product treatment. | No notification/PWA dependency. | Restore from `origin/main`. | Low |
| `src/app/(public)/not-found.tsx` | Replaced shared `EmptyState` and shadcn `Button` with manual card/anchor. | 404 page loses product UI consistency. | No notification/PWA dependency. | Restore from `origin/main`. | Low |

## B. Restore Partially

These files must be merged carefully. Do not blindly overwrite from `origin/main`, because `ui-recovery` contains features that must be preserved.

| File | Why it changed | User-facing regression | Notifications/PWA dependency | Exact restore strategy | Risk |
|---|---|---|---|---|---|
| `src/components/public/language-switcher.tsx` | Changed script loading to conditional/callback behavior. | Translation control mainly disappeared because navbar stopped rendering it; conditional script loading may also make first-use behavior brittle. | No notification/PWA dependency. | Restore navbar rendering first. Keep callback-based load only if manual Telugu first-click test passes; otherwise restore origin/main always-initialize mount behavior. | Medium |
| `src/components/public/home-hero.tsx` | Reworked for performance/static hero and added hard-coded marketing chips. | CMS hero image ignored; photo quality falls back to hard-coded CSS background; Framer Motion/icons/buttons removed; hero became crowded. | No notification/PWA dependency. | Start from `origin/main` hero. Restore `pickGalleryImage`, local `next/image`, remote raw image fallback, Framer Motion, lucide icons, and shadcn buttons. Review whether admissions CTA/chips are truly desired; default is remove to restore original UX. | Medium |
| `src/components/public/gallery-preview.tsx` | Converted all images to `next/image` and removed motion/icons. | Supabase/CMS remote images can fail in optimizer; first image lazy-loaded; gallery loses animation/placeholders. | No notification/PWA dependency. | Restore origin/main rendering pattern: local `next/image`, remote CSS background fallback, first image eager, Framer Motion, lucide placeholders. | Low |
| `src/components/public/facilities-preview.tsx` | Converted all images to `next/image` and removed motion/icons. | Supabase/CMS facility photo can fail; cards lose icon and reveal polish. | No notification/PWA dependency. | Restore origin/main rendering pattern: local `next/image`, remote raw `<img>`, Framer Motion, icon map, shadcn button. | Low |
| `src/components/public/inquiry-section.tsx` | Replaced inline inquiry form with link to contact page; removed motion/icons/analytics. | Homepage inquiry flow became less direct and less polished. | No notification/PWA dependency. Analytics tracking should be restored. | Restore origin/main inline `ContactInquiryForm`, Framer Motion, contact icons, and tracking. If bundle size is a concern, lazy-load internals without changing visible behavior. | Medium |
| `src/components/public/contact-page-content.tsx` | Added nested `AppQueryProvider` after public provider wrapper was removed. | No major visual regression, but nested provider is a workaround. | No direct notification/PWA dependency. Depends on restored public provider. | After restoring public layout/provider, remove nested `AppQueryProvider` and return to origin/main structure. | Medium |
| `src/components/layout/public-shell.tsx` | Removed `RouteTransition`. | Public route transitions disappeared. | No notification/PWA dependency. | Restore `RouteTransition` wrapper. Keep current CMS logo resolution. | Low |
| `src/app/(public)/layout.tsx` | Removed public `SessionProviders` wrapper. | Public pages lost client/provider context that supported client controls and app polish. | PWA depends indirectly if `SessionProviders` includes `AppClientEnhancements`. | Restore wrapper using current `src/components/providers/session-providers.tsx`, not old `app-providers` import. Keep `JsonLd`. | Medium |
| `src/app/layout.tsx` | Root app wrapper removed; PWA metadata and analytics slot added. | Public provider behavior changed, but PWA and analytics were added here. | PWA and analytics depend on current metadata/slot. | Keep current root layout. Do not restore origin/main root wrapper wholesale. Fix public provider at public layout/session provider level. | Medium |
| `src/components/providers/app-providers.tsx` | Split provider responsibilities and added `AppClientEnhancements`. | If used alone, it no longer provides query/motion/error boundary like origin/main. | PWA depends on `AppClientEnhancements`; notifications may depend indirectly on providers elsewhere. | Keep current file unless a consumer still expects origin/main behavior. Do not overwrite with origin/main because that would drop PWA enhancements. | Medium |
| `src/components/providers/session-providers.tsx` | New provider file for admin/resident/auth sessions and realtime/PWA enhancements. | Missing `MotionProvider` may contribute to lost animation context on wrapped areas. | Notifications, realtime, auth, and PWA depend on this file. | Keep current auth/query/realtime/Sentry/connectivity/AppClientEnhancements. Add back `MotionProvider` around children if needed for restored Framer Motion behavior. | High |
| `src/components/resident/resident-dashboard-client.tsx` | Reworked into mobile home screen with notice popup and notification count. | Original dashboard metrics and quick actions disappeared; leave/support/security access is no longer surfaced. | Notice acknowledgements and smart notifications depend on current hooks/UI. | Merge origin/main dashboard structure back in: `PageHeader`, metrics, `useLeaves`, quick actions. Preserve current notice popup, acknowledgement handling, notification count, fee due status, invoice action, and tenant-safe ledger reuse. | High |
| `src/components/resident/resident-payments-client.tsx` | Reworked into simplified mobile finance tabs/sheets. | Original finance density disappeared: summary cards, payment breakdown, visible payment form, timeline, and richer history cards removed. | Smart notifications depend on realtime subscription; finance reminders depend on due-status logic; PWA does not directly depend. | Restore original visible payments UX. Preserve current safe fixes: ledger reuse if complete, dynamic QR import, null-safe invoice open, due status, partial progress, notification realtime. | High |
| `src/components/layout/dashboard-shell.tsx` | Replaced resident full mobile navigation with new four-tab component; added `DashboardUserActions area`. | Resident mobile users lose direct access to leave/support/security routes. | Notification bell/push/logout depend on current `DashboardUserActions area={area}`. | Restore resident full navigation access and resident sheet menu. Preserve `DashboardUserActions area={area}` and PWA-safe bottom padding. | High |
| `src/components/layout/mobile-bottom-nav.tsx` | Added four-tab resident bottom navigation. | Hard-codes Home/Pay/Notices/Profile and hides other resident routes. | No backend notification dependency, but navigational entry to notification/notices is visible here. | Replace hard-coded four-tab filtering with full resident nav, or remove file and restore inline origin/main nav in `DashboardShell`. Preserve safe-area padding/touch size. | Medium |
| `src/components/layout/dashboard-user-actions.tsx` | Added notification center, push controls, archive/mark-read, and area-specific logout. | Header is heavier, but this is required functionality rather than a UI regression. | Direct dependency for notifications, push subscriptions, PWA tenant cleanup. | Keep current functionality. Only adjust spacing/placement if dashboard shell restoration requires it. | High |
| `src/components/resident/resident-notices-client.tsx` | Upgraded resident notice center with filters, read/ack actions, and mobile layout. | It differs from origin/main but supports required notice acknowledgement UX. | Direct notice/acknowledgement dependency. | Keep current behavior. Only style-adjust if needed after dashboard/nav restore. | High |

## C. Keep As-Is

These files should remain from `ui-recovery` because they preserve required features or are not the cause of the UI regressions.

### PWA Infrastructure

| File | Why it changed | User-facing regression | Notifications/PWA dependency | Strategy | Risk if restored |
|---|---|---|---|---|---|
| `next.config.ts` | Added image remote patterns and service worker headers. | Remote image optimizer behavior is risky, but public photo fallback restoration solves it without reverting config. | PWA service worker headers depend on this. | Keep as-is unless runtime proves config itself breaks images. | High |
| `public/sw.js` | Added service worker. | None in requested UI scope. | Direct PWA dependency. | Keep as-is. | High |
| `src/app/manifest.ts` | Added/changed PWA manifest. | None in requested UI scope. | Direct PWA dependency. | Keep as-is. | High |
| `src/components/pwa/pwa-install-prompt.tsx` | Added install prompt. | None in requested UI scope. | Direct PWA dependency. | Keep as-is. | High |
| `src/components/pwa/pwa-lifecycle.tsx` | Added PWA lifecycle handling. | None in requested UI scope. | Direct PWA dependency. | Keep as-is. | High |
| `src/lib/pwa/client.ts` | Added service worker/client helpers. | None in requested UI scope. | Direct PWA dependency. | Keep as-is. | High |
| `src/components/providers/app-client-enhancements.tsx` | Added lazy PWA install prompt, service worker registration, and toaster loading. | None by itself; provider placement needs partial review. | Direct PWA dependency. | Keep as-is. | High |

### Notice, Acknowledgement, and Smart Notification Files

| File | Why it changed | User-facing regression | Notifications/PWA dependency | Strategy | Risk if restored |
|---|---|---|---|---|---|
| `src/app/api/notices/[id]/acknowledge/route.ts` | Added acknowledgement API. | None. | Notice acknowledgement dependency. | Keep as-is. | High |
| `src/app/api/notices/[id]/read/route.ts` | Added read tracking API. | None. | Notice read dependency. | Keep as-is. | High |
| `src/app/api/notifications/[id]/archive/route.ts` | Added notification archive API. | None. | Notification center dependency. | Keep as-is. | High |
| `src/app/api/notifications/push-subscriptions/route.ts` | Added push subscription API. | None. | Push notification dependency. | Keep as-is. | High |
| `src/app/api/notifications/push-subscriptions/revoke/route.ts` | Added push revoke API. | None. | Logout/security/PWA dependency. | Keep as-is. | High |
| `src/jobs/payment-reminder.job.ts` | Added/changed reminder scheduling. | None in UI scope. | Smart notification dependency. | Keep as-is. | High |
| `src/jobs/scheduled-notices.job.ts` | Added scheduled notice delivery. | None in UI scope. | Notice/notification dependency. | Keep as-is. | High |
| `src/jobs/scheduler/cron-registry.ts` | Registered scheduled jobs. | None in UI scope. | Smart notification dependency. | Keep as-is. | High |
| `src/lib/notices/audience.ts` | Added notice targeting logic. | None. | Notice system dependency. | Keep as-is. | High |
| `src/lib/notices/notification-classification.ts` | Added notice-to-notification classification. | None. | Notice/notification dependency. | Keep as-is. | High |
| `src/lib/notifications/catalog.ts` | Added notification catalog. | None. | Smart notification dependency. | Keep as-is. | High |

### Analytics

| File | Why it changed | User-facing regression | Notifications/PWA dependency | Strategy | Risk if restored |
|---|---|---|---|---|---|
| `src/components/analytics/google-analytics-slot.tsx` | Added analytics integration. | None. | Analytics dependency. | Keep as-is. | High |
| `src/lib/analytics/google-analytics.ts` | Added/changed public tracking helpers. | Some UI components stopped calling helpers, but helpers themselves should stay. | Analytics dependency. | Keep as-is; restore UI call sites in public navbar/footer/inquiry. | High |

### Database Migrations

| File | Why it changed | User-facing regression | Notifications/PWA dependency | Strategy | Risk if restored |
|---|---|---|---|---|---|
| `supabase/migrations/20260606001000_resident_notice_reads.sql` | Added notice reads. | None in UI scope. | Notice reads dependency. | Keep as-is. Do not touch migrations. | Critical |
| `supabase/migrations/20260606002000_smart_notification_center.sql` | Added notification center structures. | None in UI scope. | Smart notifications dependency. | Keep as-is. Do not touch migrations. | Critical |
| `supabase/migrations/20260606003000_notice_acknowledgements.sql` | Added acknowledgement storage. | None in UI scope. | Notice acknowledgements dependency. | Keep as-is. Do not touch migrations. | Critical |
| `supabase/migrations/20260606004000_pwa_push_subscriptions.sql` | Added push subscriptions. | None in UI scope. | Push/PWA dependency. | Keep as-is. Do not touch migrations. | Critical |

### DR Scripts

| File | Why it changed | User-facing regression | Notifications/PWA dependency | Strategy | Risk if restored |
|---|---|---|---|---|---|
| `scripts/recovery/manual-dr-common.ts` | Added DR validation helper. | None. | No notification/PWA dependency. | Keep as-is. | High for DR readiness |
| `scripts/recovery/manual-dr-validation.ts` | Added manual DR validation. | None. | No notification/PWA dependency. | Keep as-is. | High for DR readiness |
| `scripts/recovery/manual-google-drive-backup.ts` | Added Google Drive backup validation. | None. | No notification/PWA dependency. | Keep as-is. | High for DR readiness |
| `scripts/recovery/manual-storage-restore.ts` | Added storage restore validation. | None. | No notification/PWA dependency. | Keep as-is. | High for DR readiness |
| `scripts/recovery/restore-db.sh` | Added DB restore script. | None. | No notification/PWA dependency. | Keep as-is. | High for DR readiness |
| `scripts/recovery/restore-storage.sh` | Added storage restore script. | None. | No notification/PWA dependency. | Keep as-is. | High for DR readiness |

## Specifically Requested File Analysis

### `public-navbar.tsx`

- Category: Restore Completely.
- Why it changed: public navigation was simplified into static server markup.
- Regression: translations disappeared, active nav disappeared, mobile menu downgraded, icons/buttons/tracking removed.
- Notifications/PWA dependency: none.
- Strategy: restore from `origin/main`; verify language switcher, mobile drawer, auth actions, contact tracking, and active state.
- Risk: Low.

### `language-switcher.tsx`

- Category: Restore Partially.
- Why it changed: translation script loading was made conditional and callback-based.
- Regression: not visible because navbar stopped rendering it; first-click behavior may be brittle.
- Notifications/PWA dependency: none.
- Strategy: restore rendering from navbar first. Keep callback behavior only after manual EN/TE verification; otherwise restore origin/main mount initialization.
- Risk: Medium.

### `public-nav-client-controls.tsx`

- Category: Restore Completely by deletion.
- Why it changed: introduced as dynamic replacement for navbar controls.
- Regression: orphaned, so translation/menu controls do not display.
- Notifications/PWA dependency: none.
- Strategy: delete unless chosen as the explicit mounted navbar control implementation.
- Risk: Low.

### `home-hero.tsx`

- Category: Restore Partially.
- Why it changed: hero was static-optimized and expanded with hard-coded chips/CTA.
- Regression: CMS hero ignored; image quality/rendering changed; Framer Motion/icons/buttons removed; hero crowded.
- Notifications/PWA dependency: none.
- Strategy: restore origin/main composition, image selection, and image fallback behavior. Review any new admissions content before re-adding.
- Risk: Medium.

### `gallery-preview.tsx`

- Category: Restore Partially.
- Why it changed: all images were converted to `next/image`, and animation/icons were removed.
- Regression: Supabase/CMS photos can stop rendering; first image lazy loads; gallery loses motion and icons.
- Notifications/PWA dependency: none.
- Strategy: restore origin/main remote fallback and animation/icon behavior.
- Risk: Low.

### `facilities-preview.tsx`

- Category: Restore Partially.
- Why it changed: all images were converted to `next/image`, and animation/icons were removed.
- Regression: facility image can break; cards lose icons and reveal polish.
- Notifications/PWA dependency: none.
- Strategy: restore origin/main remote fallback and animation/icon behavior.
- Risk: Low.

### `testimonials-section.tsx`

- Category: Restore Completely.
- Why it changed: converted to static server component.
- Regression: removed Framer Motion, quote icon, and star icons.
- Notifications/PWA dependency: none.
- Strategy: restore from `origin/main`.
- Risk: Low.

### `inquiry-section.tsx`

- Category: Restore Partially.
- Why it changed: inline contact form was removed for performance/simplification.
- Regression: homepage inquiry no longer has the original form, motion, icons, or analytics.
- Notifications/PWA dependency: none.
- Strategy: restore visible origin/main inquiry form and tracking; only keep lazy loading if visually identical.
- Risk: Medium.

### `app-providers.tsx`

- Category: Keep As-Is pending consumer audit.
- Why it changed: provider responsibilities moved and PWA client enhancements were added.
- Regression: if used as before, it no longer supplies origin/main query/motion/error/toaster stack.
- Notifications/PWA dependency: PWA depends on `AppClientEnhancements`.
- Strategy: do not restore wholesale. Address public provider regression through `src/app/(public)/layout.tsx` and `session-providers.tsx`.
- Risk: Medium.

### `session-providers.tsx`

- Category: Restore Partially.
- Why it changed: new route-group provider for auth/query/realtime/PWA enhancements.
- Regression: missing motion provider can weaken restored animation consistency.
- Notifications/PWA dependency: high; auth, realtime, notifications, and PWA enhancements depend on this file.
- Strategy: keep current provider responsibilities; add motion/error wrapper only if needed and without removing realtime/PWA.
- Risk: High.

### `resident-dashboard-client.tsx`

- Category: Restore Partially.
- Why it changed: rebuilt as mobile resident home with notice/notification features.
- Regression: original metrics, leave status, advance status, and quick actions disappeared.
- Notifications/PWA dependency: notices, acknowledgements, and notifications depend on current hooks/UI.
- Strategy: merge original dashboard layout back while preserving current notice popup, acknowledgement, notification count, due banner, and invoice actions.
- Risk: High.

### `resident-payments-client.tsx`

- Category: Restore Partially.
- Why it changed: rebuilt into mobile tab/sheet finance UX.
- Regression: original visible payment workflow, summary cards, breakdown, timeline, and rich history disappeared.
- Notifications/PWA dependency: smart notification realtime and fee due status logic should stay.
- Strategy: restore original visible finance layout while preserving ledger reuse, due-status improvements, partial progress, dynamic QR import, null-safe invoice opening, and realtime notifications.
- Risk: High.

## Safe To Restore Now

These can be restored with low risk because they have no direct notice/notification/PWA dependency.

- `src/components/public/public-navbar.tsx`
- `src/components/public/public-mobile-menu.tsx`
- `src/components/public/public-nav-client-controls.tsx` deletion
- `src/components/layout/public-shell.tsx`
- `src/components/public/home-highlights.tsx`
- `src/components/public/testimonials-section.tsx`
- `src/components/public/about-preview.tsx`
- `src/components/public/final-cta.tsx`
- `src/components/public/local-search-links.tsx`
- `src/components/public/location-cta.tsx`
- `src/components/public/public-footer.tsx`
- `src/app/(public)/error.tsx`
- `src/app/(public)/loading.tsx`
- `src/app/(public)/not-found.tsx`

Mostly safe but must be visually verified after restore:

- `src/components/public/home-hero.tsx`
- `src/components/public/gallery-preview.tsx`
- `src/components/public/facilities-preview.tsx`
- `src/components/public/inquiry-section.tsx`
- `src/components/public/contact-page-content.tsx`
- `src/components/public/language-switcher.tsx`

## Requires Manual Review

These should not be restored wholesale from `origin/main`.

- `src/app/layout.tsx`
- `src/app/(public)/layout.tsx`
- `src/components/providers/app-providers.tsx`
- `src/components/providers/session-providers.tsx`
- `src/components/layout/dashboard-shell.tsx`
- `src/components/layout/dashboard-user-actions.tsx`
- `src/components/layout/mobile-bottom-nav.tsx`
- `src/components/resident/resident-dashboard-client.tsx`
- `src/components/resident/resident-payments-client.tsx`
- `src/components/resident/resident-notices-client.tsx`
- `next.config.ts`

Reason: these contain or support PWA, push, notices, acknowledgements, smart notifications, auth/session, analytics, or tenant cleanup behavior.

## Files That Should Be Restored From `origin/main`

- `src/components/public/public-navbar.tsx`
- `src/components/public/public-mobile-menu.tsx`
- `src/components/public/home-highlights.tsx`
- `src/components/public/testimonials-section.tsx`
- `src/components/public/about-preview.tsx`
- `src/components/public/final-cta.tsx`
- `src/components/public/local-search-links.tsx`
- `src/components/public/location-cta.tsx`
- `src/components/public/public-footer.tsx`
- `src/app/(public)/loading.tsx`
- `src/app/(public)/not-found.tsx`

Restore from `origin/main` with small selective preservation:

- `src/app/(public)/error.tsx`
- `src/components/public/language-switcher.tsx`
- `src/components/public/home-hero.tsx`
- `src/components/public/gallery-preview.tsx`
- `src/components/public/facilities-preview.tsx`
- `src/components/public/inquiry-section.tsx`
- `src/components/public/contact-page-content.tsx`
- `src/components/layout/public-shell.tsx`

Delete because it did not exist in `origin/main` and is currently orphaned:

- `src/components/public/public-nav-client-controls.tsx`
- `src/components/public/lazy-contact-inquiry-form.tsx`, only if no references remain after restoring `inquiry-section.tsx`.

## Files That Should Remain From `ui-recovery`

- `next.config.ts`
- `public/sw.js`
- `src/app/layout.tsx`
- `src/app/manifest.ts`
- `src/components/analytics/google-analytics-slot.tsx`
- `src/components/providers/app-client-enhancements.tsx`
- `src/components/pwa/pwa-install-prompt.tsx`
- `src/components/pwa/pwa-lifecycle.tsx`
- `src/lib/pwa/client.ts`
- `src/lib/analytics/google-analytics.ts`
- `src/app/api/notices/[id]/acknowledge/route.ts`
- `src/app/api/notices/[id]/read/route.ts`
- `src/app/api/notifications/[id]/archive/route.ts`
- `src/app/api/notifications/push-subscriptions/route.ts`
- `src/app/api/notifications/push-subscriptions/revoke/route.ts`
- `src/jobs/payment-reminder.job.ts`
- `src/jobs/scheduled-notices.job.ts`
- `src/jobs/scheduler/cron-registry.ts`
- `src/lib/notices/audience.ts`
- `src/lib/notices/notification-classification.ts`
- `src/lib/notifications/catalog.ts`
- `supabase/migrations/20260606001000_resident_notice_reads.sql`
- `supabase/migrations/20260606002000_smart_notification_center.sql`
- `supabase/migrations/20260606003000_notice_acknowledgements.sql`
- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`
- `scripts/recovery/manual-dr-common.ts`
- `scripts/recovery/manual-dr-validation.ts`
- `scripts/recovery/manual-google-drive-backup.ts`
- `scripts/recovery/manual-storage-restore.ts`
- `scripts/recovery/restore-db.sh`
- `scripts/recovery/restore-storage.sh`

Remain from `ui-recovery` but merge UI restoration around them:

- `src/components/providers/app-providers.tsx`
- `src/components/providers/session-providers.tsx`
- `src/components/layout/dashboard-user-actions.tsx`
- `src/components/resident/resident-notices-client.tsx`

## Implementation Order

1. Public navbar and translation
   - Restore `public-navbar.tsx`, `public-mobile-menu.tsx`.
   - Remove or wire `public-nav-client-controls.tsx`.
   - Verify language switcher on desktop and mobile.

2. Public photos and hero
   - Restore hero image selection and remote fallback.
   - Restore gallery/facility remote fallbacks.
   - Verify Supabase/CMS images render.

3. Public motion and homepage polish
   - Restore motion/icon/button components.
   - Restore `RouteTransition`.

4. Provider review
   - Restore public `SessionProviders` wrapper using current provider file.
   - Preserve PWA and analytics.

5. Resident dashboard
   - Merge original metrics and quick actions with notice/notification features.

6. Resident payments
   - Merge original visible payment experience with current finance fixes.

7. Resident navigation
   - Restore full resident mobile navigation while preserving notification bell/push/logout.

## Verification Gates After Implementation

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:security`
- `npm run build`

Manual checks:

- Public homepage desktop/mobile.
- Hero uses uploaded/CMS image.
- Gallery/facility Supabase images render.
- Telugu translation switcher visible and functional.
- Public mobile menu uses rich drawer.
- Framer Motion route/section animations visible.
- Resident dashboard includes original metrics plus notices/notifications.
- Resident payments includes original visible payment flow plus current smart finance fixes.
- PWA install/service worker remains active.
- Analytics remains active.

## Final Risk Summary

- Lowest risk: restoring public visual components with no feature dependency.
- Medium risk: public provider/language/hero/photo restoration because runtime verification is needed.
- Highest risk: resident dashboard/payments/provider merges because they must preserve notice, acknowledgement, notification, push, tenant, and finance fixes while restoring original UX.
