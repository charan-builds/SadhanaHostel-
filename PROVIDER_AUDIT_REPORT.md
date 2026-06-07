# Provider and Translation Audit Report

Date: 2026-06-07

Comparison: `origin/main..ui-recovery`

Scope: read-only investigation of provider/layout files and related translation initialization. No source files were modified.

Files audited:

- `src/components/providers/app-providers.tsx`
- `src/components/providers/session-providers.tsx`
- `src/components/providers/app-client-enhancements.tsx`
- `src/app/layout.tsx`
- `src/app/(public)/layout.tsx`
- `src/components/public/language-switcher.tsx`

Note: the current working tree already contains the Phase 1 public UI restore. The provider/layout files audited here are still unchanged from `ui-recovery`, so this report applies to remaining provider/layout risk. `language-switcher.tsx` differs in `ui-recovery` branch history, but the current working tree has been restored to `origin/main` behavior.

## Executive Summary

The main remaining provider/layout risk is public-page client infrastructure:

- `origin/main` wrapped public pages in `SessionProviders loadSessionOnMount={false}`.
- `ui-recovery` removed that wrapper from `src/app/(public)/layout.tsx`.
- `ui-recovery` also removed root `AppProviders` from `src/app/layout.tsx`.
- `AppClientEnhancements` exists, but public pages do not mount it through root or public layout.

This means public pages no longer get a shared public client provider boundary by default. That can still cause:

- public auth action context errors unless locally wrapped,
- inconsistent public toast/PWA install prompt behavior,
- public service worker registration not happening on public-only visits,
- public UI inconsistencies where restored client components expect query/auth/provider context.

It is not the direct cause of image rendering issues. Those came from public image component changes and Next image optimizer behavior, not providers.

## Origin/Main vs Ui-Recovery Changes

### `src/app/layout.tsx`

Origin/main behavior:

- Imported `AppProviders`.
- Wrapped all route groups with `<AppProviders>{children}</AppProviders>`.
- Mounted `GoogleAnalytics` from `@next/third-parties/google` conditionally via `analyticsConfig`.

Ui-recovery behavior:

- Removed root `<AppProviders>`.
- Renders raw `{children}` inside `<body>`.
- Adds PWA mobile metadata and `viewport`.
- Replaces `@next/third-parties/google` with local `<GoogleAnalyticsSlot />`.

Impact:

- Public pages no longer inherit `AppProviders`.
- PWA metadata and analytics additions should be preserved.
- The root layout no longer provides a universal client boundary.

Can cause remaining issues:

- Translation issues: unlikely directly. `LanguageSwitcher` does not require `AppProviders`.
- Image issues: no.
- Hydration issues: possible if public client components assume app-wide providers.
- Turbopack manifest issues: not directly, but changing root client boundaries can alter chunk graphs.
- Public UI inconsistencies: yes, if components expect shared query/toast/error/motion context.

Category: `SAFE TO KEEP`, with public provider restoration handled in `src/app/(public)/layout.tsx`.

Recommended action:

- Keep PWA metadata and `GoogleAnalyticsSlot`.
- Do not restore root `AppProviders` wholesale unless PWA/analytics mounting is reworked.

### `src/app/(public)/layout.tsx`

Origin/main behavior:

- Imported `SessionProviders` from `app-providers`.
- Wrapped public shell with `<SessionProviders loadSessionOnMount={false}>`.
- Rendered `JsonLd` and `PublicShell` inside that provider.

Ui-recovery behavior:

- Removed `SessionProviders`.
- Public layout now renders only a fragment containing `JsonLd` and `PublicShell`.

Impact:

- Public pages lack the shared public auth/query/realtime/client enhancement boundary.
- This directly explains why restored `PublicAuthActions` and `ContactInquiryForm` needed local provider wrappers during Phase 1.
- This also means public-only visits may not mount `AppClientEnhancements`.

Can cause remaining issues:

- Translation issues: mostly no, now that `LanguageSwitcher` is restored. It can indirectly affect client infrastructure but not Google Translate itself.
- Image issues: no.
- Hydration issues: yes, for public components needing query/auth providers.
- Turbopack manifest issues: not directly.
- Public UI inconsistencies: yes.

Category: `SHOULD BE RESTORED` or `SAFE TO PARTIALLY RESTORE`.

Recommended action:

- Restore a public provider wrapper, but import from current `src/components/providers/session-providers.tsx`, not old `app-providers.tsx`.
- Use `<SessionProviders loadSessionOnMount={false}>`.
- Confirm this does not duplicate local wrappers introduced during Phase 1; if public layout is restored, local wrappers in `public-navbar.tsx`, `public-mobile-menu.tsx`, `inquiry-section.tsx`, and `contact-page-content.tsx` can be reviewed and removed later.

### `src/components/providers/app-providers.tsx`

Origin/main behavior:

- Client component.
- Provided `AppQueryProvider`.
- Provided `MotionProvider`.
- Wrapped children in `ErrorBoundary`.
- Mounted `Toaster`.
- Also exported `SessionProviders` with `AuthProvider`, Sentry sync, connectivity banner, and realtime provider.

Ui-recovery behavior:

- No `"use client"`.
- Only renders children plus `AppClientEnhancements`.
- No longer exports `SessionProviders`.
- Does not provide query, motion, error boundary, or toaster directly.

Impact:

- The old root app provider behavior is gone.
- If any future code uses `AppProviders` expecting origin/main behavior, it will not get query/motion/error boundary.
- Current route groups mostly use the new `session-providers.tsx`, so this file is less important until root layout uses it again.

Can cause remaining issues:

- Translation issues: no.
- Image issues: no.
- Hydration issues: possible if used as a provider substitute.
- Turbopack manifest issues: unlikely directly.
- Public UI inconsistencies: possible if root/public route expects old provider stack.

Category: `SAFE TO PARTIALLY RESTORE`.

Recommended action:

- Do not restore origin/main file wholesale because that would drop `AppClientEnhancements`.
- If needed, rebuild it as a true root app provider:
  - `AppQueryProvider`
  - `MotionProvider`
  - `ErrorBoundary`
  - children
  - `AppClientEnhancements`
- Keep `SessionProviders` in the new dedicated file.

### `src/components/providers/session-providers.tsx`

Origin/main behavior:

- File did not exist.
- `SessionProviders` lived inside `app-providers.tsx`.
- Old `SessionProviders` included auth, Sentry sync, connectivity banner, and realtime provider.
- It depended on `AppQueryProvider` being mounted by parent `AppProviders`.

Ui-recovery behavior:

- New dedicated client provider.
- Includes `AppQueryProvider`.
- Includes `AuthProvider`.
- Includes `SentryContextSync`.
- Includes `ConnectivityRecoveryBanner`.
- Includes `RealtimeProvider`.
- Includes `AppClientEnhancements`.

Impact:

- Admin/resident/auth route groups now get query/auth/realtime/PWA client enhancements from this provider.
- Public routes do not use it.
- This is now the strongest provider for authenticated route groups and should not be reverted.

Can cause remaining issues:

- Translation issues: not directly.
- Image issues: no.
- Hydration issues: possible if nested/local provider wrappers duplicate query/auth contexts on public pages.
- Turbopack manifest issues: unlikely directly.
- Public UI inconsistencies: only because public routes are not wrapped with it.

Category: `SAFE TO KEEP`, with optional partial restore.

Recommended action:

- Keep current provider stack.
- Consider adding `MotionProvider` and possibly `ErrorBoundary` inside this file to restore origin/main provider richness without removing PWA/realtime.
- Use this provider in public layout with `loadSessionOnMount={false}` if public auth/query/PWA behavior should be consistent.

### `src/components/providers/app-client-enhancements.tsx`

Origin/main behavior:

- File did not exist.
- `Toaster` was mounted synchronously from `app-providers.tsx`.
- PWA install prompt and service worker registration did not exist here.

Ui-recovery behavior:

- New client enhancement component.
- On idle or timeout, dynamically imports:
  - `@/lib/pwa/client` to register service worker,
  - `@/components/ui/sonner` for toaster,
  - `@/components/pwa/pwa-install-prompt` for install prompt.

Impact:

- Preserves PWA/install/toast behavior without increasing critical bundle as much.
- Depends on being mounted somewhere.
- Currently mounted through `SessionProviders` for admin/resident/auth.
- Not mounted on public pages unless public layout or root provider includes it.

Can cause remaining issues:

- Translation issues: no.
- Image issues: no.
- Hydration issues: low risk; it only renders prompt/toaster after client idle load.
- Turbopack manifest issues: low direct risk, but dynamic imports create extra chunks and can expose stale dev-manifest problems.
- Public UI inconsistencies: yes, because public pages may not get service worker registration/toaster/install prompt when this is not mounted.

Category: `SAFE TO KEEP`.

Recommended action:

- Keep it.
- Ensure it is mounted once for public pages, preferably via restored public `SessionProviders` or a dedicated public client enhancements wrapper.
- Avoid multiple independent mounts if public layout and local wrappers are both later adjusted.

### `src/components/public/language-switcher.tsx`

Origin/main behavior:

- Always called `loadGoogleTranslate()` on mount.
- On Telugu selection, set `googtrans` cookie and immediately tried `applyGoogleTranslateLanguage("te")`.

Ui-recovery branch behavior:

- Loaded Google Translate only when state was Telugu.
- Added callback-based `loadGoogleTranslate(() => apply...)`.

Current working tree after Phase 1:

- Restored to origin/main behavior.

Impact:

- The main translation regression was navbar rendering, not provider context.
- Since Phase 1 restored navbar rendering and language-switcher behavior, provider files are no longer the likely primary cause if the switcher is visible but translation still fails.

Can cause remaining issues:

- Translation issues: branch `ui-recovery` version could, current restored version is safer.
- Image issues: no.
- Hydration issues: unlikely.
- Turbopack manifest issues: no.
- Public UI inconsistencies: no.

Category: `SAFE TO KEEP` in the current working tree.

Recommended action:

- Keep current restored behavior.
- Verify in browser because Google Translate behavior depends on external script/cookies.

## Query Client Changes

Origin/main:

- Root `AppProviders` mounted `AppQueryProvider`.
- Public layout mounted `SessionProviders`, which assumed the query provider was already present from root.

Ui-recovery:

- Root no longer mounts query provider.
- New `SessionProviders` includes `AppQueryProvider`.
- Public layout no longer mounts `SessionProviders`, so public pages no longer have route-wide query context.

Current practical effect:

- Admin/resident/auth routes are covered.
- Public routes are not covered globally.
- Phase 1 had to locally wrap:
  - `PublicAuthActions` in navbar/menu,
  - `ContactInquiryForm` in inquiry section.

Risk:

- More public components that call React Query hooks can fail prerender or hydration if added without local wrappers.
- Multiple local providers can create isolated query caches, which is functional but inconsistent.

Recommendation:

- Prefer restoring a public route-level provider using current `SessionProviders loadSessionOnMount={false}`.

## Session Changes

Origin/main:

- Public pages got `SessionProviders loadSessionOnMount={false}`.
- Admin/resident/auth got `SessionProviders` from `app-providers.tsx`.

Ui-recovery:

- Admin/resident/auth moved to `src/components/providers/session-providers.tsx`.
- Public pages lost session provider.
- Auth layout changed from `SessionProviders` plus `RouteTransition` to `SessionProviders loadSessionOnMount={false}` with no route transition.

Risk:

- Public auth actions need context.
- Public pages do not share session state.
- Public PWA client enhancements do not mount through session provider.

Recommendation:

- Keep new session provider file.
- Restore public layout provider wrapper with `loadSessionOnMount={false}`.
- Consider adding `MotionProvider` into `SessionProviders` if route groups need consistent motion configuration.

## Hydration Changes

Relevant changes:

- Root app is now server-only with raw children.
- Public layout is server-only with no provider wrapper.
- Local wrappers in public components create client islands where needed.
- `AppClientEnhancements` dynamically loads after idle.

Can still cause hydration issues:

- Medium risk on public pages if local wrappers produce session-dependent UI that differs after mount.
- Low risk for translation switcher itself.
- Low risk for images.

Recommendation:

- Route-level public provider is cleaner than scattered local wrappers.
- Avoid restoring root `AppProviders` wholesale until PWA/analytics behavior is planned.

## Turbopack Manifest Risk

These provider/layout changes are not a strong direct root cause for finance chunk manifest errors such as missing `admin_finance_layout` or `finance-section-nav` chunks.

Potential indirect contributors:

- Changing root provider/client boundaries can alter chunk graph.
- `AppClientEnhancements` adds dynamic chunks for PWA, toaster, and install prompt.
- Orphaned/lazy public components such as `public-nav-client-controls.tsx` add dynamic chunks, but they are unrelated to finance route chunks.
- Stale `.next/dev` generated state can cause misleading type/manifest symptoms; Phase 1 observed a corrupted `.next/dev/types/validator.ts` that was fixed by clearing `.next/dev`.

Recommendation:

- For Turbopack manifest issues, inspect stale `.next/dev`, route-group chunks, and finance dynamic imports first.
- Do not restore providers solely to fix finance manifest errors unless a reproduction shows provider boundary involvement.

## Can These Files Still Cause Reported Issues?

| Issue | Can audited files still cause it? | Finding |
|---|---:|---|
| Translation issues | Partially | Public layout/provider removal is not the direct cause. In `ui-recovery`, navbar and language switcher changes were direct causes. In the current working tree, translation is restored in code; remaining failures would likely be browser/script/cookie verification issues. |
| Image issues | No | Image issues were caused by public image component rendering and `next/image` remote optimizer behavior, not providers/layouts. |
| Hydration issues | Yes | Public pages lack route-level query/auth provider; local wrappers can work but create isolated client islands. |
| Turbopack manifest issues | Unlikely directly | Provider changes can alter chunks, but missing finance chunks are more likely stale `.next/dev` or route/chunk boundary issues. |
| Public UI inconsistencies | Yes | Public pages do not mount shared `SessionProviders`, `MotionProvider`, `ErrorBoundary`, or `AppClientEnhancements` at route level. |

## Categorization

### SAFE TO KEEP

- `src/app/layout.tsx`
  - Keep PWA metadata and `GoogleAnalyticsSlot`.
  - Do not restore root `AppProviders` wholesale.

- `src/components/providers/app-client-enhancements.tsx`
  - Keep PWA/toaster/install prompt lazy loading.
  - Ensure it is mounted for public pages later.

- `src/components/providers/session-providers.tsx`
  - Keep current query/auth/realtime/Sentry/connectivity/PWA provider stack.
  - This is required for admin/resident/auth and likely useful for public once reintroduced.

- `src/components/public/language-switcher.tsx`
  - Current working tree is restored to origin/main behavior.
  - Keep and verify in browser.

### SAFE TO PARTIALLY RESTORE

- `src/components/providers/app-providers.tsx`
  - Safe to rebuild as a richer root provider only if needed.
  - Preserve `AppClientEnhancements`; do not revert to origin/main exactly.

- `src/components/providers/session-providers.tsx`
  - Optional partial restore: add `MotionProvider` and/or `ErrorBoundary` while keeping current query/auth/realtime/PWA stack.

### SHOULD BE RESTORED

- `src/app/(public)/layout.tsx`
  - Restore public route-level provider wrapper using current `SessionProviders`.
  - Suggested shape:

```tsx
<SessionProviders loadSessionOnMount={false}>
  <JsonLd data={createPublicSiteJsonLd()} />
  <PublicShell>{children}</PublicShell>
</SessionProviders>
```

  - After this, remove or review local provider wrappers added in public navbar/mobile menu/inquiry/contact to avoid isolated query/auth islands.

## Final Recommendation

The remaining provider issue is not the root layout alone. It is the combination of:

1. Root layout no longer mounting `AppProviders`.
2. Public layout no longer mounting `SessionProviders`.
3. New `SessionProviders` being used by admin/resident/auth only.
4. `AppClientEnhancements` existing but not mounted for public pages.

Best next step:

- Partially restore `src/app/(public)/layout.tsx` to wrap public pages with the current `SessionProviders loadSessionOnMount={false}`.
- Keep root layout, `GoogleAnalyticsSlot`, PWA metadata, and `AppClientEnhancements`.
- Do not restore `app-providers.tsx` from `origin/main` wholesale.
