# Public Provider Restore Report

Date: 2026-06-07

Scope: `PUBLIC_PROVIDER_RESTORE`

## Files Changed

Source files changed in this phase:

- `src/app/(public)/layout.tsx`
- `src/components/public/public-navbar.tsx`
- `src/components/public/public-mobile-menu.tsx`
- `src/components/public/inquiry-section.tsx`
- `src/components/public/contact-page-content.tsx`

Report added:

- `PUBLIC_PROVIDER_RESTORE_REPORT.md`

No resident dashboard, resident payments, migrations, PWA infrastructure, push notification, notice, smart notification, analytics implementation, or database files were modified.

## Provider Hierarchy Before

Public routes rendered as:

```tsx
<>
  <JsonLd data={createPublicSiteJsonLd()} />
  <PublicShell>{children}</PublicShell>
</>
```

Practical effect:

- Public pages had no route-level `SessionProviders`.
- `AppClientEnhancements` did not mount for public-only visits.
- Public auth actions and inquiry forms needed local `AppQueryProvider` / `AuthProvider` wrappers.
- Public pages had isolated provider islands instead of one shared public boundary.

## Provider Hierarchy After

Public routes now render as:

```tsx
<SessionProviders loadSessionOnMount={false}>
  <JsonLd data={createPublicSiteJsonLd()} />
  <PublicShell>{children}</PublicShell>
</SessionProviders>
```

Practical effect:

- Public pages now use the current `ui-recovery` `SessionProviders` implementation.
- Public pages get shared `AppQueryProvider`, `AuthProvider`, `SentryContextSync`, `ConnectivityRecoveryBanner`, `RealtimeProvider`, and `AppClientEnhancements`.
- PWA/client enhancements remain preserved.
- Root `app-providers.tsx` was not restored from `origin/main`.

## Redundant Wrapper Cleanup

The local wrappers added during Phase 1 are now redundant and were removed from the inspected public files:

- `PublicNavbar`: removed local `AppQueryProvider` + `AuthProvider` around `PublicAuthActions`.
- `PublicMobileMenu`: removed local `AppQueryProvider` + `AuthProvider` around mobile `PublicAuthActions`.
- `InquirySection`: removed local `AppQueryProvider` around `ContactInquiryForm`.
- `ContactPageContent`: removed local `AppQueryProvider` around `ContactInquiryForm`.

## Translation Verification

Status: PASS.

Verified with built app on `http://localhost:3012/`:

- Desktop language controls render.
- Mobile compact Telugu control renders.
- Google Translate script initialization tag is requested.
- Selecting Telugu writes the expected `googtrans=/en/te` cookie.

Note: external Google Translate rendering still depends on the third-party script loading in the browser, but the local app-side initialization and cookie flow passed.

## Navbar Verification

Status: PASS.

Runtime smoke verified:

- Public navbar renders.
- Brand home link is visible and scoped to the header.
- Desktop login action renders.
- No relevant console or page errors during the public smoke check.

## Mobile Menu Verification

Status: PASS.

Runtime smoke verified:

- Mobile compact translation control renders.
- Mobile menu button opens the sheet.
- Resident and Admin public auth links render inside the mobile sheet.

## Public Auth Verification

Status: PASS.

Runtime smoke verified:

- Desktop `Login` dropdown renders from the route-level provider.
- `Resident Portal` menu item renders.
- `Admin Portal` menu item renders.
- Mobile menu renders `Resident` and `Admin` auth actions from the route-level provider.

## Inquiry Form Verification

Status: PASS.

Runtime smoke verified with the public inquiry API intercepted to avoid creating real data:

- Homepage inquiry form renders without a local query provider.
- Name, phone, and message fields accept input.
- Submit uses the route-level provider and receives a successful standard API envelope.
- Success state appears: `Inquiry saved.`

## Build Status

Verification commands:

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS

Additional runtime smoke:

- Built app served with `npx next start -p 3012`.
- Playwright checked public navbar, translation controls, auth actions, mobile menu, and inquiry form.
- Temporary verification server was stopped after checks.

## GO / NO-GO

GO for `PUBLIC_PROVIDER_RESTORE`.

Reason: the public route-level provider boundary is restored using the current `SessionProviders`, redundant local provider islands were removed only from the approved inspected files, PWA/client enhancements remain mounted through the current provider, and lint/typecheck/build plus targeted runtime smoke all pass.
