# Public UI Restore Report

Date: 2026-06-07

Scope: `PUBLIC_UI_RESTORE_PHASE_1`

## Files Changed

Only the approved public UI files were changed:

- `src/components/public/public-navbar.tsx`
- `src/components/public/language-switcher.tsx`
- `src/components/public/home-hero.tsx`
- `src/components/public/gallery-preview.tsx`
- `src/components/public/facilities-preview.tsx`
- `src/components/public/testimonials-section.tsx`
- `src/components/public/home-highlights.tsx`
- `src/components/public/inquiry-section.tsx`
- `src/components/public/public-mobile-menu.tsx`

No migrations, PWA files, notification files, notice files, analytics files, resident files, app providers, or layouts were modified.

## Translations Status

Status: Restored in code.

- `PublicNavbar` again renders `LanguageSwitcher` on desktop and compact mobile.
- `PublicMobileMenu` again uses the rich sheet menu and restored public auth action area.
- `language-switcher.tsx` was restored to the `origin/main` behavior.

Note: Because app providers/layouts were intentionally not modified in this phase, `PublicAuthActions` is locally wrapped with query/auth providers inside the approved navbar/menu files to keep public prerendering stable.

## Photo Rendering Status

Status: Restored in code.

- `HomeHero` again uses `pickGalleryImage(...)` for CMS/gallery hero images.
- `HomeHero` again uses priority `next/image` for local images and raw remote image fallback for remote/CMS images.
- `FacilitiesPreview` again uses local `next/image` and raw `<img loading="lazy">` fallback for remote facility images.
- `GalleryPreview` again uses local `next/image`, remote CSS background fallback, and eager loading for the first preview image.

## Animation Status

Status: Public section animations restored.

- Framer Motion restored in:
  - `home-hero.tsx`
  - `gallery-preview.tsx`
  - `facilities-preview.tsx`
  - `testimonials-section.tsx`
  - `home-highlights.tsx`
  - `inquiry-section.tsx`

Note: Layout-level route transitions were not restored in this phase because layouts were explicitly out of scope.

## Homepage Experience Status

Status: Restored in code.

- Hero composition restored from `origin/main`.
- Hard-coded trust/rating chips and fixed WhatsApp hero button were removed by restoring the original hero.
- Inquiry section restored to the original visible form experience with Framer Motion and contact tracking.
- The inline inquiry form is locally wrapped with `AppQueryProvider` inside `inquiry-section.tsx` so public layouts remain untouched.

## Navbar Behavior Status

Status: Restored in code.

- `next/link` navigation restored.
- Active route state restored.
- Desktop call/WhatsApp icon buttons restored.
- Language switcher restored.
- Rich mobile sheet menu restored.
- Public auth actions restored.
- Contact tracking calls restored.

Compatibility note: `public-mobile-menu.tsx` keeps the original UI but now also accepts the existing `defaultOpen` compatibility prop so the current branch's dynamic helper remains type-safe without modifying that helper.

## Build Status

Final verification:

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS

During verification, the first standalone typecheck failed on a corrupted generated `.next/dev/types/validator.ts`. The generated `.next/dev` cache was cleared, then `npm run typecheck` passed. No tracked source files outside the approved public UI list were changed for that cache cleanup.

## Preserved Systems

The following were not modified:

- PWA infrastructure
- Push notifications
- Notice system
- Notice acknowledgements
- Smart notifications
- Analytics files
- Security fixes
- Database migrations
- Resident dashboard
- Resident payments
- App providers
- Layouts

## GO / NO-GO

GO for Public UI Restore Phase 1.

Reason: the approved public UI files were restored, photo fallback behavior and translations were restored in code, Framer Motion section animations are back, and lint/typecheck/build all pass.
