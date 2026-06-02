# Public Pages

## Purpose

Document the public website frontend structure, content responsibilities, CMS integration points, SEO requirements, and performance strategy.

## Scope

Public routes:

- `/`
- `/about`
- `/rooms`
- `/facilities`
- `/gallery`
- `/contact`
- `/terms`
- `/pulivendula-boys-hostel`
- `/student-hostel-pulivendula`
- `/employee-hostel-pulivendula`

## Responsibilities

Frontend developers own:

- Public page layouts.
- SEO-friendly component structure.
- Responsive design.
- CMS data rendering.
- Contact/inquiry UI.

Backend developers own:

- CMS tables and APIs.
- Inquiry persistence.
- Storage access for gallery.
- Cache revalidation triggers.

## Architecture Overview

```txt
Public route
  -> Server Component
  -> Fetch published CMS data
  -> Render SEO metadata
  -> Render public sections
  -> Revalidate after admin publish
```

## Page Structure

| Page | Sections | Data Source |
| --- | --- | --- |
| Home | Hero, highlights, rooms preview, facilities, contact CTA | CMS + website settings |
| About | Hostel story, values, management, policies | CMS page |
| Rooms | Room types, pricing, amenities, CTA | CMS + room summaries |
| Facilities | Facility cards, safety, food, Wi-Fi, housekeeping | CMS page |
| Gallery | Albums, image grid, categories | `gallery`, storage |
| Contact | Contact details, inquiry form, map | `website_settings`, inquiries API |
| Terms | Rules, privacy, refunds, payment policy | CMS page |
| Pulivendula hostel | Local hostel search landing page | Static constants |
| Student hostel Pulivendula | Student search landing page | Static constants |
| Employee hostel Pulivendula | Employee search landing page | Static constants |

## CMS Rendering Contract

```ts
type PublicPageContent = {
  slug: string
  title: string
  seoTitle: string
  seoDescription: string
  sections: Array<{
    type: "hero" | "cards" | "gallery" | "richText" | "cta"
    props: Record<string, unknown>
  }>
}
```

## Contact Inquiry Workflow

```txt
Visitor fills contact form
  -> Client validates fields
  -> Server action validates again
  -> Backend stores inquiry
  -> Admin notification created
  -> UI shows success state
```

## SEO Checklist

- [x] Metadata per public route.
- [x] Open Graph and Twitter image routes.
- [x] Canonical URLs through the shared SEO URL resolver.
- [x] Sitemap with Pulivendula landing pages and image entries.
- [x] Robots file that indexes production public pages and blocks private routes.
- [x] Local business structured data.
- [x] FAQ, offer catalog, accommodation offer, breadcrumb, and item list structured data.
- [x] Meaningful alt text for primary public images.
- [ ] Search Console verification and sitemap submission after production deploy.
- [ ] Google Business Profile name, address, phone, website, and photos aligned after production deploy.

## Performance Requirements

- Use optimized images.
- Render public pages statically where possible.
- Revalidate only after CMS publish.
- Avoid unnecessary client components.
- Keep contact form client bundle small.

## TODO Placeholders

- TODO: Define CMS section renderer components.
- TODO: Define homepage final content model.
- TODO: Define gallery filters.
- TODO: Define inquiry success and failure copy.
- TODO: Define CMS-owned SEO metadata source fields for future admin editing.

## Future Scalability Notes

- Support additional hostel-specific landing pages with `hostel_id`.
- Add custom domain routing per organization.
- Add multilingual CMS content.
- Add A/B testing only after traffic volume justifies it.
