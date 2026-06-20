# Minimal Homepage UI Update Report

## Scope

Frontend-only homepage UI update. No backend, API, database, Supabase, auth, analytics, notification, environment, package, dependency, service, repository, validation, or type files were modified.

## Changes Completed

1. Added `Rules` to the public header navigation.
   - Existing route used: `/terms`
   - No new route or page created.

2. Added `Check Availability` to the homepage hero CTA row.
   - Final button order: `Check Availability`, `Call Now`, `WhatsApp`, `View on Map`
   - The new button links to the existing homepage inquiry section: `#inquiry`
   - No hero redesign was performed.

3. Simplified the homepage inquiry form UI.
   - Homepage visible fields are now:
     - Full Name
     - Mobile Number
     - WhatsApp Number
   - Primary button: `Request Callback`
   - Secondary button: `Contact on WhatsApp`
   - Existing submission hook, payload structure, success message, and tracking calls were preserved.
   - The full contact page inquiry form remains available through the default form variant.

## Files Updated

- `src/constants/public-content.ts`
- `src/components/public/home-hero.tsx`
- `src/components/public/inquiry-section.tsx`
- `src/components/forms/contact-inquiry-form.tsx`

## Validation

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

Note: During `npm run build`, existing repository fallback logs appeared for default organization resolution (`Unable to resolve default organization.`). The build completed successfully with exit code `0`.
