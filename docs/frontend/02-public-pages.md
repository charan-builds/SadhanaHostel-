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

- [ ] Metadata per route.
- [ ] Open Graph image.
- [ ] Canonical URLs.
- [ ] Sitemap.
- [ ] Robots file.
- [ ] Local business structured data.
- [ ] Meaningful alt text.

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
- TODO: Define SEO metadata source fields.

## Future Scalability Notes

- Support hostel-specific landing pages with `hostel_id`.
- Add custom domain routing per organization.
- Add multilingual CMS content.
- Add A/B testing only after traffic volume justifies it.

