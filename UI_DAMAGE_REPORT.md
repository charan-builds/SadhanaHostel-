# UI Damage Investigation Report

Date: 2026-06-07

Scope: compared the current working tree against `origin/main` for public homepage, hero, photos, translation system, navbar, mobile menu, resident dashboard, and resident finance.

Commands used:

- `git diff --stat origin/main..HEAD -- ...targeted paths...`
- `git diff --unified=3 origin/main..HEAD -- ...targeted paths...`
- `rg` for `Framer Motion`, provider, translation, mobile menu, image, dashboard, and finance call sites
- `nl -ba` for current line evidence

No application code was fixed in this investigation.

## Executive Summary

The UI regression is mainly caused by a performance/PWA-oriented simplification pass that converted multiple polished client components into static server-rendered markup. That reduced bundle weight, but it also removed visible affordances: Framer Motion reveal animations, lucide icons, button-system styling, active nav states, the custom mobile menu, and public translation controls.

The most severe user-facing damage is:

1. Public translation controls disappeared from the navbar.
2. CMS/gallery-driven public photos are no longer reliably rendered, especially Supabase-hosted images converted to `next/image`.
3. The public hero now ignores uploaded/CMS hero images and uses a hard-coded CSS background.
4. Public navigation was downgraded from `next/link` plus active states plus custom mobile drawer to plain anchors and native `details`.
5. Public shell/provider changes removed the route transition and public session/client wrapper that previously hosted motion/error/toast/session behavior.
6. Resident dashboard and finance were redesigned for mobile, but several existing workflows and informational surfaces were removed or hidden.

## High-Risk Issues

| Severity | Area | File | Exact change | User impact |
|---|---|---|---|---|
| Critical | Translation | `src/components/public/public-navbar.tsx` | Removed `"use client"`, `LanguageSwitcher`, `PublicMobileMenu`, `PublicAuthActions`, `usePathname`, active-route logic, analytics click handlers, and `next/link`. Current navbar renders only plain `<a>` links and native `<details>` menu at lines 1-99. | Public users no longer see the language switcher. Telugu translation appears missing even though `LanguageSwitcher` still exists elsewhere. Navbar also loses active state, icons, richer auth actions, and contact tracking. |
| Critical | Translation | `src/components/public/public-nav-client-controls.tsx` | Added a dynamic wrapper that renders `LanguageSwitcher` and lazy-loads `PublicMobileMenu`, but it is not referenced by the navbar or any layout. `rg` only finds the component definition, no render call. | Intended replacement for client navbar controls is orphaned. Translation and rich mobile menu code exists but never reaches the page. |
| High | Translation | `src/components/public/language-switcher.tsx` | Changed mount behavior from always calling `loadGoogleTranslate()` to only loading when local language state is Telugu. Current effect is lines 153-157. | If the switcher is restored, script initialization is now more conditional. This is not the main missing-translation cause, but it makes translation behavior more brittle than `origin/main`. |
| High | Public providers/layout | `src/app/layout.tsx` | Removed root `<AppProviders>{children}</AppProviders>` and now renders raw `{children}` in `<body>` at lines 87-89. | Public routes no longer inherit the root app provider stack that previously included query, motion, error boundary, and toaster behavior through `AppProviders`. |
| High | Public providers/layout | `src/app/(public)/layout.tsx` | Removed `<SessionProviders loadSessionOnMount={false}>` around the public shell. Current layout renders a fragment with `JsonLd` and `PublicShell`. | Public pages lost the public session/client wrapper. This likely contributed to missing client-only controls and changed runtime behavior around auth/session hydration. |
| Medium | Public providers/layout | `src/components/providers/app-providers.tsx` | `AppProviders` was reduced to children plus `AppClientEnhancements`; `MotionProvider`, `ErrorBoundary`, `Toaster`, and `AppQueryProvider` were removed from this file. | The shared provider composition was split. Admin/resident/auth have the new `session-providers.tsx`, but public pages are no longer covered by the previous public wrapper. |
| Medium | Public layout animation | `src/components/layout/public-shell.tsx` | Removed `<RouteTransition>` around public page content and replaced it with a plain `<div>`. Current lines 135-139. | Page-to-page public route animation/polish is gone. Navigation feels more abrupt. |
| Critical | Photos | `src/components/public/gallery-preview.tsx` | Converted all `item.imageUrl` values to `next/image` and set `loading="lazy"` for every preview image, including the first large image. Current lines 38-47. `origin/main` only used `next/image` for local URLs and used CSS background for remote URLs. | Supabase/CMS photos are now routed through Next image optimization. This is a likely cause of broken photos when the optimizer rejects the upstream URL or resolved address. The first visible gallery image is also delayed. |
| High | Photos | `src/components/public/facilities-preview.tsx` | Converted facility image rendering to unconditional `next/image` at lines 41-47. `origin/main` used `next/image` only for local images and raw `<img loading="lazy">` for remote CMS images. | Same Supabase/CMS image break risk as gallery. A broken optimized image is more visible here because it is the large facility visual. |
| High | Photos/hero | `src/components/public/home-hero.tsx` | Removed `pickGalleryImage(...)`, added `void galleryItems`, hard-coded `hostelImages.hero`, and renders it as a CSS `backgroundImage`. Current lines 34-44. | Uploaded/CMS hero photos are ignored. The public hero can show stale/default imagery instead of the admin-managed hostel photo. CSS background also loses `next/image` priority/loading semantics and image alt text. |
| High | Public mobile menu | `src/components/public/public-navbar.tsx` | Replaced the custom `PublicMobileMenu` sheet with native `<details>` at lines 67-94. | Mobile menu quality drops: no app-like drawer, no active route state, no language switcher, no contact CTA icons, no `PublicAuthActions`, and weaker interaction polish. |
| High | Resident mobile navigation | `src/components/layout/mobile-bottom-nav.tsx` | New bottom nav hard-codes only Home, Pay, Notices, Profile at lines 11-16. `DashboardShell` now hides the resident sheet navigation and renders only this component for resident mobile at lines 95-139. | Resident mobile users lose direct bottom/sheet access to other resident workflows such as leave, support, and security. This may match a mobile-simplification goal, but it explains why the portal feels less complete. |

## Public Homepage Damage

| Severity | File | Exact change | User impact |
|---|---|---|---|
| Medium | `src/components/public/home-hero.tsx` | Removed `"use client"`, `framer-motion`, `motion.div`, lucide icons, and `Button`. Current component is static server markup with plain anchors. | Hero entrance animation and icon-rich CTA styling are gone. The first viewport feels flatter and less premium. |
| High | `src/components/public/home-hero.tsx` | Added several hard-coded visual chips: `ratingSignals`, `trustSignals`, `quickBenefits`, fee chip, and a fixed WhatsApp floating button. Current lines 12-21 and 59-163. | Hero became more crowded, especially on mobile. The floating WhatsApp button can compete with bottom navigation and other fixed CTAs. |
| Medium | `src/components/public/home-highlights.tsx` | Removed `"use client"`, Framer Motion stagger, lucide icon map, and actual icons. Current cards show a blank rounded square at line 55. | Highlights lost recognizable facility icons and reveal animation. Cards look unfinished compared with `origin/main`. |
| Medium | `src/components/public/facilities-preview.tsx` | Removed Framer Motion reveal/stagger and the lucide facility icon map. Current cards use only a small dot at line 65. | Facility cards lose visual scanning cues and animated polish. |
| Medium | `src/components/public/gallery-preview.tsx` | Removed Framer Motion stagger/reveal and placeholder lucide icons. Current placeholder is a text pill saying `Photo` at lines 50-53. | Gallery preview feels more static and less designed. |
| Medium | `src/components/public/testimonials-section.tsx` | Removed Framer Motion and lucide `Quote`/`Star`; current UI uses a text quote mark and `5 / 5`. Current lines 23-30. | Testimonials lose star icon quality and entrance animation. This is a visual downgrade even if content remains. |

## Removed Framer Motion Inventory

| File | `origin/main` behavior | Current behavior |
|---|---|---|
| `src/components/public/home-hero.tsx` | Client component using `motion.div` with opacity, y, and blur entrance. | Server component with static `<div>`. |
| `src/components/public/facilities-preview.tsx` | Client component using `motion.div`, `motion.article`, `whileInView`, and staggered reveal. | Server component with static cards. |
| `src/components/public/gallery-preview.tsx` | Client component using `motion.div`, `motion.article`, `whileInView`, and staggered reveal. | Server component with static cards. |
| `src/components/public/home-highlights.tsx` | Client component using `motion.div`, `motion.article`, and staggered reveal. | Server component with static cards. |
| `src/components/public/testimonials-section.tsx` | Client component using `motion.div`, `motion.article`, and staggered reveal. | Server component with static testimonials. |
| `src/components/resident/resident-payments-client.tsx` | Larger animated finance surface with animated progress width, animated payment timeline, and animated history cards. | Still imports `motion`, but many animated finance sections were removed and progress bar width is now static inline style at lines 727-729. |

## Navbar and Mobile Menu

| Severity | File | Exact change | User impact |
|---|---|---|---|
| Critical | `src/components/public/public-navbar.tsx` | Replaced `Link` with plain `<a>` tags. Removed `usePathname` and `isActivePath`. Current nav anchors are lines 26-35. | Current page is no longer highlighted. Internal navigation loses Next route prefetch behavior and feels less app-like. |
| High | `src/components/public/public-navbar.tsx` | Removed lucide `Phone` and `MessageCircle` icons and `Button` components; current contact/login links are tiny `h-7` anchors at lines 38-66. | Header CTAs are visually smaller and less clear. Contact actions feel downgraded. |
| Critical | `src/components/public/public-navbar.tsx` | Removed both desktop and compact `LanguageSwitcher` render points. | Direct cause of missing translation control on the public site. |
| High | `src/components/public/public-mobile-menu.tsx` | The component still exists and was modified to use `usePathname`, but the public navbar no longer renders it. | Rich mobile drawer implementation is dead code for the public shell. |
| High | `src/components/public/public-nav-client-controls.tsx` | New component dynamically loads `LanguageSwitcher` and `PublicMobileMenu`, but no parent renders it. | The likely intended performance-safe replacement was never wired in. |

## Photo Rendering

| Severity | File | Exact change | User impact |
|---|---|---|---|
| Critical | `src/components/public/gallery-preview.tsx` | Unconditional `next/image` for `item.imageUrl` at lines 38-47. Removed remote CSS-background fallback from `origin/main`. | Supabase-hosted gallery images can break through the Next image optimizer. This is the most likely root cause for broken public photos. |
| High | `src/components/public/facilities-preview.tsx` | Unconditional `next/image` for `facilityImageUrl` at lines 41-47. Removed remote raw `<img>` fallback from `origin/main`. | Facility photo can fail the same way as gallery photos. |
| High | `src/components/public/home-hero.tsx` | Hero uses `url(${heroImageUrl})` CSS background at lines 40-44 and hard-codes the source. | Admin/CMS hero image is ignored, image priority is no longer explicit, and assistive alt text is gone for the hero visual. |
| Medium | `next.config.ts` | Added `images.remotePatterns` for `*.supabase.co`. | This allows Supabase hostnames syntactically, but it does not address optimizer failures caused by rejected upstream/resolved addresses. It also increased reliance on optimizer behavior for CMS images. |

## Resident Dashboard

| Severity | File | Exact change | User impact |
|---|---|---|---|
| Medium | `src/components/resident/resident-dashboard-client.tsx` | Removed `useLeaves` and the Leave Status metric. Current imports/hooks no longer include `useLeaves`; dashboard cards are `Pay Fees`, `Notices`, `Notifications`, `Profile` at lines 225-247. | Resident dashboard no longer surfaces leave status. Residents must discover leave elsewhere. |
| Medium | `src/components/resident/resident-dashboard-client.tsx` | Removed original quick actions: complete profile, submit UPI payment, apply leave, report item/issue, change password. | Important workflows disappeared from the dashboard, making the resident home feel simpler but less capable. |
| Medium | `src/components/resident/resident-dashboard-client.tsx` | Replaced the desktop-style `PageHeader` and metric grid with `max-w-md` mobile card layout at lines 181-213. | Better for mobile, but desktop/tablet dashboard now has less information density and less ERP-style status visibility. |
| Medium | `src/components/resident/resident-dashboard-client.tsx` | Added notice popup logic with `Dialog` based on unread/acknowledgement notices at lines 81-85 and 256 onward. | Useful feature, but it changes login experience and can feel intrusive if unread notice data is noisy. |

## Resident Finance Page

| Severity | File | Exact change | User impact |
|---|---|---|---|
| Medium | `src/components/resident/resident-payments-client.tsx` | Removed the standalone `usePayments` query and now uses `ledger.data?.payments`. | This reduces requests, but it also changes the source and shape of payment history. Any ledger omission now affects history display. |
| Medium | `src/components/resident/resident-payments-client.tsx` | Replaced the full finance page with two tabs only: `Due & Pay` and `History`. Current `FinanceTab` is line 90 and tab UI is lines 404-414. | Requested mobile simplification is present, but the previous all-in-one finance visibility is gone. |
| Medium | `src/components/resident/resident-payments-client.tsx` | Payment form moved into a bottom `Sheet` opened by Pay Now. Current sheet starts at lines 429-437. | Primary payment flow is hidden until interaction. This is mobile-friendly but can feel like functionality disappeared. |
| Medium | `src/components/resident/resident-payments-client.tsx` | Removed summary cards for current due, monthly fee, pending verification, advance paid, next due, and verified paid. | Residents lose quick financial context that existed on `origin/main`. |
| Medium | `src/components/resident/resident-payments-client.tsx` | Removed `PaymentTimeline` and old `PaymentHistoryCards`; current history list opens a detail drawer at lines 744-915. | History is cleaner, but the visual activity timeline and richer card affordances are gone. |
| Low | `src/components/resident/resident-payments-client.tsx` | QR code generation changed from static `QRCode` import to dynamic `import("qrcode")` at the QR effect. | This is likely a valid performance improvement, not a UI regression. Mentioned only because it was part of heavy bundle splitting. |

## Likely Root Causes by Symptom

### Missing translations

Likely root cause:

1. `PublicNavbar` no longer renders `LanguageSwitcher`.
2. `PublicNavClientControls` was created to dynamically render `LanguageSwitcher`, but it is never used.
3. Public layout also lost the old `SessionProviders` wrapper, reducing public client-side infrastructure.

Primary files:

- `src/components/public/public-navbar.tsx`
- `src/components/public/public-nav-client-controls.tsx`
- `src/components/public/language-switcher.tsx`
- `src/app/(public)/layout.tsx`

### Broken photos

Likely root cause:

1. Public gallery/facility remote CMS images were converted from safe remote fallbacks to unconditional `next/image`.
2. `next.config.ts` added Supabase remote patterns, but that only permits the hostname pattern. It does not guarantee the optimizer can fetch every Supabase asset in the current runtime environment.
3. Hero now ignores `galleryItems`, so even valid uploaded images are not used for the first viewport.

Primary files:

- `src/components/public/gallery-preview.tsx`
- `src/components/public/facilities-preview.tsx`
- `src/components/public/home-hero.tsx`
- `next.config.ts`

### Degraded public UI

Likely root cause:

1. Public components were converted from client components to server components.
2. Framer Motion and lucide icons were removed from multiple homepage sections.
3. shadcn `Button`/`Link` composition was replaced with manually styled anchors.
4. Public route transition wrapper was removed.

Primary files:

- `src/components/public/home-hero.tsx`
- `src/components/public/home-highlights.tsx`
- `src/components/public/facilities-preview.tsx`
- `src/components/public/gallery-preview.tsx`
- `src/components/public/testimonials-section.tsx`
- `src/components/layout/public-shell.tsx`

### Degraded resident UI

Likely root cause:

1. Resident portal was intentionally simplified toward a four-tab mobile app model.
2. The simplification removed direct resident dashboard access to leave, support, security, and some finance status surfaces.
3. Finance information was moved behind tabs and sheets.

Primary files:

- `src/components/resident/resident-dashboard-client.tsx`
- `src/components/resident/resident-payments-client.tsx`
- `src/components/layout/mobile-bottom-nav.tsx`
- `src/components/layout/dashboard-shell.tsx`

## What Looks Safe to Keep

- Dynamic `qrcode` loading in `resident-payments-client.tsx` appears performance-positive and does not obviously explain UI damage.
- Reusing resident ledger instead of adding another payment-history request aligns with prior performance requirements.
- The new resident due status, partial payment progress, and payment detail drawer are useful mobile UX additions if the lost context is restored elsewhere.
- New `session-providers.tsx` appears to correctly wrap admin/resident/auth route groups, but public needs explicit handling if public client controls are required.

## What Is Risky and Should Be Considered for Revert/Restore

Highest priority restore candidates:

1. Restore public navbar client controls: `LanguageSwitcher`, active route state, proper `PublicMobileMenu`, and `PublicAuthActions`.
2. Restore remote image fallback behavior for Supabase/CMS photos, or add a proven safe image proxy before using `next/image` for those URLs.
3. Restore CMS hero image selection in `HomeHero` by using `pickGalleryImage(galleryItems, ...)`.
4. Restore public route transition and public provider wrapper as needed for motion/error/toast/client behavior.
5. Restore public homepage icons and Framer Motion where visual quality matters, especially hero, highlights, facilities, gallery, and testimonials.
6. Review resident mobile bottom nav to avoid hiding leave/support/security without an alternate visible path.
7. Review resident finance to reintroduce key context such as pending verification, advance paid, verified paid, and next due in a mobile-appropriate way.

## Final Assessment

This is not a single CSS bug. The damage came from several coordinated simplifications:

- public client components became static server components;
- image rendering was converted to `next/image` without preserving remote fallbacks;
- public navigation was rebuilt without wiring the replacement client controls;
- public layout/provider boundaries were changed;
- resident dashboard and finance were simplified enough to remove established workflows.

UI recovery should start with public navbar/translation and photo rendering, because those are the highest severity and easiest to validate visually.
