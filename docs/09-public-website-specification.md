# Public Website Specification

## Purpose

Define the public website pages, CMS requirements, SEO strategy, performance expectations, and content workflow.

## Overview

The public website is the first touchpoint for residents and guardians. It should communicate trust, facilities, room options, policies, contact information, and inquiry flows. Public content should become CMS-managed so admins can update website content without code deployment.

## Public Routes

| Route | Page | CMS Required | Notes |
| --- | --- | --- | --- |
| `/` | Home | Yes | Hero, highlights, room CTA, contact CTA |
| `/about` | About | Yes | Hostel story, rules, management details |
| `/rooms` | Rooms | Yes | Room types, pricing, photos, availability later |
| `/facilities` | Facilities | Yes | Food, Wi-Fi, housekeeping, safety, study |
| `/gallery` | Gallery | Yes | Albums and media |
| `/contact` | Contact | Yes | Address, phone, email, inquiry form |
| `/terms` | Terms | Yes | Policies, privacy, refund, resident rules |
| `/pulivendula-boys-hostel` | Local SEO landing page | No | Main Pulivendula hostel search page |
| `/student-hostel-pulivendula` | Student hostel landing page | No | Student accommodation search page |
| `/employee-hostel-pulivendula` | Employee hostel landing page | No | Employee accommodation search page |

## Content Model Placeholder

```txt
cms_pages
  id
  organization_id
  hostel_id
  slug
  title
  summary
  content_json
  seo_title
  seo_description
  status
  published_at

website_settings
  contact_phone
  contact_email
  address
  map_url
  social_links
  inquiry_email

gallery
  title
  category
  storage_path
  alt_text
  sort_order
  is_published
```

## Page Requirements

### Home Page

- Brand and hostel identity.
- Primary CTA for rooms or inquiry.
- Facility highlights.
- Room preview.
- Trust indicators.
- Contact CTA.

### Rooms Page

- Room categories.
- Capacity.
- Price placeholders.
- Facility inclusion.
- Gallery images.
- Inquiry CTA.

### Contact Page

- Contact details.
- Inquiry form.
- Location or map placeholder.
- Admin notification after inquiry.

## Inquiry Workflow

```txt
Visitor submits inquiry
  -> Validate form
  -> Store inquiry record
  -> Notify admin
  -> Show confirmation
  -> Future: lead follow-up status
```

## SEO Requirements

- Page-specific title and description are implemented for public routes.
- Canonical metadata uses the production app URL and fails closed if production cannot resolve a real domain.
- Regional alternate metadata emits `en-IN` and `x-default` hreflang links for public pages.
- Structured data includes local business, website, organization, breadcrumbs, FAQ, offer catalog, accommodation offers, and local landing page item lists.
- Sitemap generation includes home, rooms, facilities, gallery, contact, terms, and Pulivendula landing pages with image sitemap entries.
- Robots configuration allows public routes in production and blocks admin, resident, API, auth, activation, and reset surfaces.
- Open Graph and Twitter image routes generate a branded Sadhana Boys Hostel Pulivendula preview image.
- Alt text for public images should describe the actual hostel room, building, location, or facility shown.
- Search Console verification is controlled by `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.

## Performance Requirements

- Optimize public images.
- Use static rendering where possible.
- Cache published CMS content.
- Avoid blocking third-party scripts.
- Keep homepage fast on mobile.

## Accessibility Requirements

- Semantic headings.
- Keyboard accessible navigation.
- Sufficient contrast.
- Proper alt text.
- Form labels and validation messages.

## CMS Workflow

```txt
Admin edits content
  -> Save draft
  -> Preview, optional later
  -> Publish
  -> Revalidate public route
  -> Audit publish action
```

## TODO Placeholders

- TODO: Define CMS page JSON schema.
- TODO: Define gallery image size rules.
- TODO: Define inquiry table and admin follow-up workflow.
- TODO: Define publish preview mode.
- TODO: Define content approval workflow if needed.

## Future Expansion Notes

- Add multilingual public pages.
- Add landing pages per future hostel branch.
- Add online admission inquiry flow.
- Add testimonials.
- Add public availability indicators.
- Add blog or announcements if useful.
