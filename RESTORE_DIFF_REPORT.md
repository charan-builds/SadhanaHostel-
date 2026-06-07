# Restore Diff Report

Date: 2026-06-07

Comparison: `origin/main..ui-recovery`

Scope: UI regressions only. This report does not cover backend, database, security, PWA, analytics, notice, or notification implementation changes except where a UI file directly affects one of the requested symptoms.

No source code was changed while generating this report.

## Files by Regression Type

### Translations Disappeared

- `src/components/public/public-navbar.tsx`
- `src/components/public/public-nav-client-controls.tsx`
- `src/components/public/language-switcher.tsx`

### Photos Stopped Rendering or Lost Original Quality

- `src/components/public/home-hero.tsx`
- `src/components/public/facilities-preview.tsx`
- `src/components/public/gallery-preview.tsx`

### Framer Motion Was Removed

- `src/components/layout/public-shell.tsx`
- `src/components/public/home-hero.tsx`
- `src/components/public/home-highlights.tsx`
- `src/components/public/facilities-preview.tsx`
- `src/components/public/gallery-preview.tsx`
- `src/components/public/testimonials-section.tsx`
- `src/components/public/inquiry-section.tsx`

### Hero Section Changed

- `src/components/public/home-hero.tsx`

### Navbar Changed

- `src/components/public/public-navbar.tsx`
- `src/components/public/public-mobile-menu.tsx`
- `src/components/public/public-nav-client-controls.tsx`

### Resident Dashboard Changed

- `src/components/resident/resident-dashboard-client.tsx`
- `src/components/layout/dashboard-shell.tsx`
- `src/components/layout/mobile-bottom-nav.tsx`

### Resident Payments Page Changed

- `src/components/resident/resident-payments-client.tsx`

## Detailed File Findings

### `src/components/public/public-navbar.tsx`

1. origin/main behavior
   - Client component.
   - Used `next/link`, typed routes, `usePathname`, active nav state, and `aria-current`.
   - Rendered desktop `LanguageSwitcher`, compact mobile `LanguageSwitcher`, `PublicMobileMenu`, and `PublicAuthActions`.
   - Used shadcn `Button`, lucide `Phone` and `MessageCircle`, and contact/WhatsApp analytics tracking.

2. ui-recovery behavior
   - Converted to a server component with plain `<a>` tags.
   - Removed `LanguageSwitcher` from both desktop and mobile.
   - Removed `PublicMobileMenu` and replaced it with native `<details>`.
   - Removed active route state, icons, shadcn button styling, `PublicAuthActions`, and contact tracking.

3. recommended restore action
   - Restore the origin/main navbar interaction model.
   - Keep any current production-safe props such as `logoUrl`.
   - Reintroduce `LanguageSwitcher`, `PublicMobileMenu`, `PublicAuthActions`, `usePathname`, active route styling, lucide icons, and analytics click handlers.

### `src/components/public/public-nav-client-controls.tsx`

1. origin/main behavior
   - File did not exist.
   - Navbar directly rendered translation and mobile menu controls.

2. ui-recovery behavior
   - New client component dynamically renders `LanguageSwitcher` and lazy-loads `PublicMobileMenu`.
   - It is not wired into `PublicNavbar`, so the translation controls it contains do not appear.

3. recommended restore action
   - Either wire this component into `PublicNavbar` correctly or remove it and restore direct origin/main navbar controls.
   - Preferred restore: direct origin/main navbar behavior unless a performance-safe dynamic wrapper is proven visually identical.

### `src/components/public/language-switcher.tsx`

1. origin/main behavior
   - Loaded Google Translate on mount with `loadGoogleTranslate()`.
   - Applying Telugu set the cookie and immediately attempted `applyGoogleTranslateLanguage(...)`.

2. ui-recovery behavior
   - Only loads Google Translate when local state is Telugu.
   - Adds callback-based loading before applying Telugu.
   - This file still contains the switcher, but the navbar no longer renders it.

3. recommended restore action
   - First restore rendering from the navbar.
   - Keep callback-based loading only if manual testing confirms first-click Telugu translation works reliably.
   - Otherwise restore origin/main always-initialize behavior.

### `src/components/public/home-hero.tsx`

1. origin/main behavior
   - Client component.
   - Used `pickGalleryImage(galleryItems, ["hero", "exterior", "hostel", "building"], 0)` so CMS/gallery hero photos could appear.
   - Rendered local images with priority `next/image`.
   - Rendered remote images with raw `<img fetchPriority="high">`, avoiding Next optimizer issues for remote CMS assets.
   - Used Framer Motion entrance animation.
   - Used lucide icons and shadcn `Button` CTAs.

2. ui-recovery behavior
   - Converted to a server component.
   - Ignores `galleryItems` with `void galleryItems`.
   - Hard-codes `hostelImages.hero`.
   - Replaces foreground image rendering with CSS `backgroundImage`.
   - Removes Framer Motion, `next/image`, raw remote image fallback, lucide icons, and shadcn buttons.
   - Adds hard-coded trust/rating/benefit chips, a fee chip, admissions CTA, and fixed WhatsApp button.

3. recommended restore action
   - Restore origin/main image selection and rendering, including remote fallback.
   - Restore Framer Motion entrance, lucide icons, and shadcn buttons.
   - Remove or redesign the added chips/fixed WhatsApp button if they crowd the first viewport.
   - Keep only content additions that do not damage the original hero composition.

### `src/components/public/facilities-preview.tsx`

1. origin/main behavior
   - Client component.
   - Used Framer Motion reveal/stagger.
   - Used lucide facility icon map.
   - Rendered local facility images with `next/image`.
   - Rendered remote facility images with raw `<img loading="lazy">`.
   - Used `Link` and shadcn `Button`.

2. ui-recovery behavior
   - Converted to a server component.
   - Removes Framer Motion and facility icons.
   - Replaces icon cards with small dot markers.
   - Renders every facility image through `next/image`, including remote CMS/Supabase URLs.
   - Replaces `Link`/`Button` with a manually styled anchor.

3. recommended restore action
   - Restore Framer Motion, icon map, and button/link composition.
   - Restore local `next/image` plus remote raw `<img>` fallback to prevent Supabase image optimizer failures.

### `src/components/public/gallery-preview.tsx`

1. origin/main behavior
   - Client component.
   - Used Framer Motion reveal/stagger.
   - Used lucide placeholder icons.
   - Rendered local image URLs with `next/image`.
   - Rendered remote image URLs with CSS background fallback.
   - Loaded the first gallery image eagerly.

2. ui-recovery behavior
   - Converted to a server component.
   - Removes Framer Motion and placeholder icons.
   - Renders every `item.imageUrl` through `next/image`.
   - Sets `loading="lazy"` for all preview images, including the first large image.
   - Replaces placeholders with a text pill.

3. recommended restore action
   - Restore origin/main gallery rendering:
     - local `next/image`
     - remote fallback that does not hit Next image optimizer
     - first image eager loading
     - Framer Motion stagger
     - lucide placeholder icons.

### `src/components/layout/public-shell.tsx`

1. origin/main behavior
   - Wrapped public page content in `<RouteTransition className="flex flex-1 flex-col">`.
   - Public route transitions used Framer Motion through the shared `RouteTransition` component.

2. ui-recovery behavior
   - Removes `RouteTransition`.
   - Replaces it with a plain `<div className="flex flex-1 flex-col">`.

3. recommended restore action
   - Restore `RouteTransition` around public content.
   - Keep current CMS logo resolution behavior.

### `src/components/public/home-highlights.tsx`

1. origin/main behavior
   - Client component.
   - Used Framer Motion staggered reveal.
   - Used lucide icon map for facility-style highlights.

2. ui-recovery behavior
   - Converted to a server component.
   - Removes Framer Motion.
   - Removes lucide icons and replaces them with blank rounded squares.

3. recommended restore action
   - Restore client component behavior, motion stagger, and lucide icon map.

### `src/components/public/testimonials-section.tsx`

1. origin/main behavior
   - Client component.
   - Used Framer Motion reveal/stagger.
   - Used lucide `Quote` and `Star` icons.

2. ui-recovery behavior
   - Converted to a server component.
   - Removes Framer Motion.
   - Replaces icons with a text quote mark and `5 / 5` text.

3. recommended restore action
   - Restore Framer Motion and lucide quote/star presentation.

### `src/components/public/inquiry-section.tsx`

1. origin/main behavior
   - Client component.
   - Used Framer Motion reveal for image/contact block and form block.
   - Rendered inline `ContactInquiryForm`.
   - Used lucide contact icons.
   - Tracked contact pill clicks through analytics helpers.

2. ui-recovery behavior
   - Converted to a server component.
   - Removes Framer Motion, inline `ContactInquiryForm`, contact icons, and contact analytics.
   - Replaces the form with a simplified card linking to `/contact`.

3. recommended restore action
   - Restore the original inquiry section visual and inline form.
   - Keep performance improvements only if the visible form experience remains equivalent.

### `src/components/public/public-mobile-menu.tsx`

1. origin/main behavior
   - Rich sheet-based mobile menu.
   - Received current pathname from the navbar.
   - Rendered `PublicAuthActions mode="mobile"`.
   - Kept full CTA/icon treatment.

2. ui-recovery behavior
   - Still exists, but the navbar no longer renders it.
   - Removes `PublicAuthActions` and replaces it with simple Resident/Admin buttons.
   - Adds internal `usePathname` and `defaultOpen`.

3. recommended restore action
   - Render this menu from `PublicNavbar` again.
   - Restore `PublicAuthActions mode="mobile"` unless there is a confirmed auth bug in that component.
   - Keep only harmless API changes such as internal pathname if the UI remains identical.

### `src/components/resident/resident-dashboard-client.tsx`

1. origin/main behavior
   - Used `PageHeader` with resident greeting and Pay Fees action.
   - Showed metric grid: Profile, Payable Now, Advance, Leave Status, Notices.
   - Queried `useLeaves` and displayed latest leave status.
   - Showed quick actions: Complete profile, Submit UPI payment, Apply leave, Report item or issue, Change password.
   - Used `ResidentMetric`, `QuickAction`, `StatusBadge`, and `MotionReveal`.

2. ui-recovery behavior
   - Removes `PageHeader`, `StatusBadge`, `useLeaves`, Leave Status metric, Advance metric, and original quick-action grid.
   - Replaces dashboard with compact app-style home cards: Pay Fees, Notices, Notifications, Profile.
   - Adds notice popup, acknowledgement handling, notification count, due status banner, and invoice download action.

3. recommended restore action
   - Restore origin/main dashboard information architecture and quick actions.
   - Keep current notice/notification features by merging them into the restored layout instead of replacing the original dashboard.
   - Reintroduce leave status and direct leave/support/security actions.

### `src/components/layout/dashboard-shell.tsx`

1. origin/main behavior
   - Mobile header sheet menu was available for both admin and resident areas.
   - Resident bottom nav rendered every resident navigation item in a horizontal scroll bar.

2. ui-recovery behavior
   - Mobile sheet menu is now admin-only.
   - Resident area uses `MobileBottomNav` instead.
   - This hides resident routes not included in the new four-tab bottom nav.

3. recommended restore action
   - Restore resident access to full mobile navigation.
   - Keep `DashboardUserActions area={area}` if needed for notification bell/push/logout features.

### `src/components/layout/mobile-bottom-nav.tsx`

1. origin/main behavior
   - File did not exist.
   - Resident bottom navigation was rendered inline in `DashboardShell` and included all resident navigation items.

2. ui-recovery behavior
   - New component hard-codes four tabs: Home, Pay, Notices, Profile.
   - Filters out other resident navigation entries such as leave, support, and security.

3. recommended restore action
   - Replace hard-coded four-tab filtering with full resident navigation, or remove this component and restore the origin/main `DashboardShell` resident nav.
   - Preserve safe-area padding and touch target improvements.

### `src/components/resident/resident-payments-client.tsx`

1. origin/main behavior
   - Page titled `Payments`.
   - Showed explanatory exact-amount QR information.
   - Showed six summary cards: Current due, Monthly fee, Pending verification, Advance paid, Next due, Verified paid.
   - Showed due amount visualization with animated Framer Motion progress width.
   - Rendered `PaymentBreakdown`.
   - Rendered visible UPI payment form and QR flow on the page.
   - Rendered payment timeline and richer payment history cards.
   - Used `usePayments` for payment history and refetch.
   - Imported `QRCode` statically.

2. ui-recovery behavior
   - Page retitled `Finance`.
   - Adds two-tab UI: `Due & Pay` and `History`.
   - Moves payment form into a bottom `Sheet`.
   - Removes visible summary cards, visible due visualization, `PaymentTimeline`, and `PaymentHistoryCards`.
   - Reduces motion reveal blur and duration.
   - Adds due status, partial payment progress, payment detail drawer, invoice helpers, notification realtime subscription, and dynamic `qrcode` import.
   - Reuses `ledger.data?.payments` instead of `usePayments`.

3. recommended restore action
   - Restore origin/main visible finance information density and payment flow.
   - Keep behaviorally safe fixes:
     - ledger reuse if complete
     - dynamic QR import if behavior remains identical
     - due status and partial payment progress
     - invoice download null checks
     - realtime notification subscription.
   - Reintroduce summary cards, payment breakdown, visible UPI flow, payment timeline, and richer history cards.

## Recommended Restore Priority

1. Restore translations and navbar:
   - `src/components/public/public-navbar.tsx`
   - `src/components/public/public-mobile-menu.tsx`
   - `src/components/public/language-switcher.tsx`

2. Restore photo rendering:
   - `src/components/public/home-hero.tsx`
   - `src/components/public/facilities-preview.tsx`
   - `src/components/public/gallery-preview.tsx`

3. Restore Framer Motion and homepage polish:
   - `src/components/layout/public-shell.tsx`
   - `src/components/public/home-highlights.tsx`
   - `src/components/public/testimonials-section.tsx`
   - `src/components/public/inquiry-section.tsx`

4. Restore resident experience:
   - `src/components/resident/resident-dashboard-client.tsx`
   - `src/components/layout/dashboard-shell.tsx`
   - `src/components/layout/mobile-bottom-nav.tsx`
   - `src/components/resident/resident-payments-client.tsx`

## Exclusions

No database migrations should be changed.

This report intentionally does not recommend reverting:

- notice system backend
- notification system backend
- PWA service worker or push subscription backend
- analytics backend/integration
- security tests or RLS-related files
- package/config changes unless later proven to be the direct UI break cause
