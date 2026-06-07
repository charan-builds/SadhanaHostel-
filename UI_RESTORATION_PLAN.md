# UI Restoration Plan

Date: 2026-06-07

Objective: restore the original user experience while keeping bug fixes, security fixes, notification system, notice system, PWA, and analytics.

Status: planning only. No source code has been changed as part of this restoration plan.

## Non-Negotiable Rules

- Do not touch database migrations.
- Do not revert notice or notification database/API/service/repository work.
- Do not remove PWA service worker, manifest, install prompt, push subscription logic, or PWA metadata.
- Do not remove analytics, especially `GoogleAnalyticsSlot` and the existing analytics helpers.
- Do not use broad destructive reset/revert commands.
- Restore UI surgically by editing only the files listed below.

## Files That Would Be Changed

These are the exact source files proposed for the restoration implementation.

### Public Layout and Providers

1. `src/app/(public)/layout.tsx`
   - Restore public `SessionProviders loadSessionOnMount={false}` wrapping.
   - Import `SessionProviders` from the current `src/components/providers/session-providers.tsx`, not the old origin path.
   - Keep `JsonLd` and public SEO behavior.

2. `src/components/providers/session-providers.tsx`
   - Add `MotionProvider` around route children so restored Framer Motion behavior has the original reduced-motion configuration.
   - Keep current `AppQueryProvider`, `AuthProvider`, `RealtimeProvider`, `SentryContextSync`, `ConnectivityRecoveryBanner`, and `AppClientEnhancements`.
   - This preserves PWA registration/toaster lazy loading while restoring animation infrastructure.

3. `src/components/layout/public-shell.tsx`
   - Restore `RouteTransition` around public page content.
   - Keep current CMS logo resolution and public shell data loading.

### Public Navbar, Translation, and Mobile Menu

4. `src/components/public/public-navbar.tsx`
   - Restore the original client navbar experience:
     - `next/link`
     - active route state via `usePathname`
     - `LanguageSwitcher`
     - `PublicMobileMenu`
     - `PublicAuthActions`
     - lucide contact icons
     - shadcn `Button`
     - contact/WhatsApp analytics tracking
   - Keep current logo prop behavior.

5. `src/components/public/public-mobile-menu.tsx`
   - Restore original rich mobile drawer behavior and make sure it is rendered from `PublicNavbar`.
   - Keep any harmless current compatibility improvements only if they do not reduce UI quality.

6. `src/components/public/language-switcher.tsx`
   - Restore reliable translation initialization.
   - Keep the callback-based Telugu apply fix if it proves safer, but ensure the switcher appears in navbar and works on first use.

### Public Homepage and Public UI Polish

7. `src/components/public/home-hero.tsx`
   - Restore original hero structure:
     - CMS/gallery hero image selection with `pickGalleryImage(...)`
     - foreground optimized local image path behavior
     - remote image fallback that does not break Supabase photos
     - Framer Motion entrance
     - lucide icons
     - shadcn buttons
   - Remove the hard-coded `void galleryItems` and hard-coded CSS background-only hero.
   - Remove or demote extra crowded chips/floating WhatsApp treatment if it conflicts with original first viewport quality.

8. `src/components/public/home-highlights.tsx`
   - Restore Framer Motion staggered reveal.
   - Restore lucide facility icon map.
   - Remove blank-square icon placeholders.

9. `src/components/public/facilities-preview.tsx`
   - Restore Framer Motion reveal/stagger.
   - Restore lucide facility icon map.
   - Restore remote image fallback instead of unconditional `next/image`.
   - Keep CMS facility image selection.

10. `src/components/public/gallery-preview.tsx`
    - Restore Framer Motion staggered reveal.
    - Restore local `next/image` plus remote fallback behavior.
    - Restore first-image eager loading behavior from `origin/main`.
    - Restore lucide placeholder icons.

11. `src/components/public/testimonials-section.tsx`
    - Restore Framer Motion reveal.
    - Restore quote/star lucide icons.

12. `src/components/public/about-preview.tsx`
    - Restore lucide icons.
    - Restore `next/link` and shadcn `Button`.

13. `src/components/public/final-cta.tsx`
    - Restore lucide phone/WhatsApp icons.
    - Restore shadcn `Button` composition.

14. `src/components/public/local-search-links.tsx`
    - Restore `next/link`, route typing, map/arrow icons, and hover arrow motion.
    - Keep SEO link content.

15. `src/components/public/location-cta.tsx`
    - Restore map iframe embed and navigation/call icons.
    - Restore `next/link` and shadcn `Button`.
    - Keep current map URL helpers if compatible.

16. `src/components/public/public-footer.tsx`
    - Restore `next/link`, lucide icons, shadcn buttons, and contact analytics tracking.
    - Keep current logo prop behavior.

17. `src/components/public/inquiry-section.tsx`
    - Restore the original homepage inquiry experience:
      - Framer Motion reveal
      - contact icons
      - inline `ContactInquiryForm`
      - analytics tracking on contact pills
    - If performance remains a concern after restoration, lazy-load only below-the-fold form internals without changing the visible experience.

18. `src/components/public/contact-page-content.tsx`
    - Remove the nested `AppQueryProvider` wrapper once the public layout provider is restored.
    - Keep original contact page UI and analytics.

### Public Error and Loading Surfaces

19. `src/app/(public)/error.tsx`
    - Restore `APIErrorState` presentation.
    - Keep dynamic Sentry import if desired for bundle size, as long as the visual error state matches the original quality.

20. `src/app/(public)/loading.tsx`
    - Restore shared `LoadingState` presentation.

21. `src/app/(public)/not-found.tsx`
    - Restore `EmptyState`, `Button`, and `next/link` presentation.

### Resident Experience

22. `src/components/resident/resident-dashboard-client.tsx`
    - Restore original resident dashboard structure:
      - `PageHeader`
      - profile/payable/advance/leave/notices metric grid
      - quick actions for profile, payments, leave, support, security
    - Keep current notification and notice features:
      - unread notification count
      - unread notice/acknowledgement popup
      - fee due status banner if it can fit without replacing original dashboard information.
    - Keep tenant-safe hooks and current ledger reuse.

23. `src/components/resident/resident-payments-client.tsx`
    - Restore original finance information density and visible payment workflow:
      - summary fee cards
      - due amount visualization
      - payment breakdown
      - visible UPI payment form
      - payment timeline
      - richer payment history cards
    - Keep current fixes/features:
      - ledger reuse instead of duplicate payment requests where correct
      - dynamic QR import if it remains behaviorally identical
      - fee due status calculation
      - partial payment progress
      - invoice download safety
      - notification realtime subscription.

24. `src/components/layout/dashboard-shell.tsx`
    - Restore resident mobile access to full navigation.
    - Bring back the mobile sheet menu for residents, not only admins.
    - Keep current `DashboardUserActions area={area}` signature so notification bell, push controls, and logout behavior remain.

25. `src/components/layout/mobile-bottom-nav.tsx`
    - Replace the hard-coded four-tab resident bottom nav with the original full resident navigation behavior, or render all resident navigation items in a horizontally scrollable bar.
    - Keep touch-friendly sizing and safe-area padding.

## Files Intentionally Not Planned for Change

These files are changed on the branch, but should not be touched for this UI restoration unless a later verification proves they are directly breaking UI.

### Database and Generated Types

- `supabase/migrations/20260606001000_resident_notice_reads.sql`
- `supabase/migrations/20260606002000_smart_notification_center.sql`
- `supabase/migrations/20260606003000_notice_acknowledgements.sql`
- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`
- `src/types/database.ts`
- `src/types/notices.ts`
- `src/types/residents.ts`

### Notice and Notification Backend

- `src/app/api/notices/[id]/acknowledge/route.ts`
- `src/app/api/notices/[id]/read/route.ts`
- `src/app/api/notifications/[id]/archive/route.ts`
- `src/repositories/notice-acknowledgements.repository.ts`
- `src/repositories/notice-reads.repository.ts`
- `src/repositories/notices.repository.ts`
- `src/repositories/notifications.repository.ts`
- `src/services/notices.service.ts`
- `src/services/notifications/notification.service.ts`
- `src/services/notifications/types.ts`
- `src/lib/notices/audience.ts`
- `src/lib/notices/notification-classification.ts`
- `src/lib/notifications/catalog.ts`
- `src/hooks/use-notices.ts`
- `src/hooks/use-notifications.ts`
- `src/sdk/notices.sdk.ts`
- `src/sdk/notifications.sdk.ts`
- `src/validations/notice.validation.ts`
- `src/validations/notification.validation.ts`

### PWA and Push

- `public/sw.js`
- `src/app/manifest.ts`
- `src/app/pwa-icon/[size]/route.tsx`
- `src/components/pwa/pwa-install-prompt.tsx`
- `src/components/pwa/pwa-lifecycle.tsx`
- `src/app/api/notifications/push-subscriptions/route.ts`
- `src/app/api/notifications/push-subscriptions/revoke/route.ts`
- `src/hooks/use-web-push.ts`
- `src/lib/pwa/client.ts`
- `src/repositories/push-subscriptions.repository.ts`
- `src/services/pwa/push-subscriptions.service.ts`
- `src/services/pwa/web-push.service.ts`
- `src/validations/pwa.validation.ts`

### Analytics

- `src/components/analytics/google-analytics-slot.tsx`
- `src/lib/analytics/google-analytics.ts`
- `src/sdk/analytics.sdk.ts`
- `src/services/analytics.service.ts`
- `src/components/admin/analytics/owner-dashboard-client.tsx`

### Admin, Security, and Operations

- `src/components/admin/notices/admin-notices-client.tsx`
- `src/components/admin/operations/admin-automation-client.tsx`
- `src/components/admin/finance/finance-section-nav.tsx`
- `src/components/admin/settings/admin-settings-client.tsx`
- `src/services/auth.service.ts`
- `src/services/support.service.ts`
- `src/repositories/residents.repository.ts`
- `src/services/residents.service.ts`
- `src/sdk/residents.sdk.ts`
- `src/validations/platform.validation.ts`
- `src/tests/security/migration-security-static.test.ts`
- `src/tests/security/tenant-isolation-static.test.ts`

### Config and Package Files

- `next.config.ts`
- `package.json`
- `package-lock.json`

Reason: PWA service worker headers, package additions, and Supabase image remote patterns should remain until runtime verification proves they are harmful. Photo quality will be restored by reverting public remote image rendering fallbacks rather than removing PWA/config work.

### New Utility Files Kept Unless They Cause Lint Failures

- `src/components/providers/app-client-enhancements.tsx`
- `src/components/providers/app-providers.tsx`
- `src/components/public/public-nav-client-controls.tsx`
- `src/components/public/lazy-contact-inquiry-form.tsx`

Reason: these are not required for restoration if the main public navbar and inquiry section are restored. If they become unused dead weight or fail lint, clean them up in a separate, explicitly listed cleanup step.

## Restoration Sequence

1. Public shell and providers
   - Restore public provider wrapper and route transition first.
   - Confirm PWA and analytics remain mounted.

2. Navbar and translation
   - Restore navbar, language switcher, rich mobile menu, auth actions, active states, and contact tracking.
   - Manually verify English/Telugu toggle on desktop and mobile.

3. Public photos
   - Restore CMS hero selection.
   - Restore local `next/image` plus remote fallback logic for gallery/facility photos.
   - Verify Supabase-hosted photos render without Next optimizer failures.

4. Homepage polish
   - Restore Framer Motion and icon/button presentation across hero, highlights, facilities, gallery, testimonials, inquiry, CTA, footer, and local SEO blocks.

5. Resident dashboard
   - Merge original dashboard metrics/quick actions with current notice/notification features.
   - Confirm leave/support/security are visible again.

6. Resident finance
   - Restore original finance visibility while preserving current finance fixes and ledger reuse.
   - Confirm payment flow, QR, invoice download, payment timeline, and history all work.

7. Resident navigation
   - Restore full resident navigation access on mobile.
   - Preserve touch-friendly bottom navigation and notification bell.

## Verification Plan After Implementation

Required commands:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:security`
- `npm run build`

Manual UI checks:

- Public homepage desktop and mobile screenshot.
- Hero uses uploaded/CMS image when available.
- Gallery and facility Supabase/CMS photos render.
- Translation switcher visible and functional on desktop and mobile.
- Public mobile menu opens as rich drawer.
- Route transitions and section reveal animations are visible.
- Resident dashboard shows original metric/quick-action richness plus notifications/notices.
- Resident finance shows original visible payment flow plus current due/reminder improvements.
- PWA install prompt and service worker registration still work.
- Analytics slot still renders when configured.

## GO / NO-GO Criteria

GO only if:

- Every listed verification command passes.
- No database migration is modified.
- Notice and notification APIs remain intact.
- PWA service worker/install/push code remains intact.
- Analytics remains intact.
- Public photos, translations, animations, homepage, navbar, mobile menu, resident dashboard, and resident finance are visually restored.

NO-GO if:

- Any verification command fails.
- Public translations are still missing.
- Supabase/CMS photos are still broken.
- Resident leave/support/security access remains hidden on mobile.
- Any migration or notice/notification backend file is changed unintentionally.
