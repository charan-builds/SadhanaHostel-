# Local SEO Go-Live Checklist

Use this checklist when launching Sadhana Boys Hostel for Pulivendula hostel search visibility.

## Production Environment

Configure these values only on the live Vercel Production environment:

```bash
NEXT_PUBLIC_APP_URL=https://<production-domain>
NEXT_PUBLIC_LAUNCH_MODE=production
LAUNCH_MODE=production
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<google-search-console-meta-token>
```

Do not set production indexing mode for preview or staging deployments.

## Pre-Indexing Checks

After production deploy, verify the public SEO surfaces:

```bash
curl -fsS https://<production-domain>/robots.txt
curl -fsS https://<production-domain>/sitemap.xml
curl -I https://<production-domain>/pulivendula-boys-hostel
curl -I https://<production-domain>/hostel-in-pulivendula
curl -I https://<production-domain>/student-hostel-pulivendula
curl -I https://<production-domain>/employee-hostel-pulivendula
```

Expected:

- `robots.txt` allows public pages and lists the production sitemap.
- `sitemap.xml` contains the home page, rooms, contact, gallery, facilities, and Pulivendula landing pages.
- Sitemap `lastmod` values are stable and reflect the latest meaningful public website content update; update them only after real content, media, metadata, or structured-data changes.
- Public landing pages return `200`.
- `/hostel-in-pulivendula` returns a permanent redirect to `/pulivendula-boys-hostel`; do not add the alias itself to the sitemap.
- Admin, resident, API, activation, login, and reset-password surfaces remain blocked from indexing.
- No sitemap, robots, canonical, Open Graph, or JSON-LD URL contains `localhost`, preview domains, or placeholder domains.

## Google Search Console

1. Add the production domain property.
2. Use the HTML meta tag method and copy only the `content` token into `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.
3. Redeploy production.
4. Verify ownership.
5. Submit `https://<production-domain>/sitemap.xml`.
6. Use URL Inspection for:
   - `https://<production-domain>/`
   - `https://<production-domain>/pulivendula-boys-hostel`
   - `https://<production-domain>/student-hostel-pulivendula`
   - `https://<production-domain>/employee-hostel-pulivendula`

## Google Business Profile

Keep the business profile consistent with the website:

- Name: `Sadhana Boys Hostel`
- Category: hostel or lodging category closest to the actual listing options.
- Address: `C67M+7W2, Palem Street, Royals Rd, Bakarapuram, Pulivendula, Andhra Pradesh 516390, India`
- Phone: `7013762904`
- Website: production domain home page.
- Map/listing URL: keep aligned with the Google Maps CID used in the site.
- Add real hostel photos matching the website gallery.
- Ask actual residents/guardians for honest reviews only. Do not add fake reviews, fake ratings, or copied testimonials.

## Monthly SEO Maintenance

- Check Search Console indexing and sitemap status.
- Check query impressions for Pulivendula hostel phrases.
- Keep fees, phone, address, and photos consistent across the website and Google Business Profile.
- Add real, useful page updates only when something changes: facilities, room photos, contact details, pricing, or admission rules.
