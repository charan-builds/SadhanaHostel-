import type { Metadata } from "next"

import { hostelConfig } from "@/constants/hostel"
import { hostelImages } from "@/constants/hostel-images"
import { fallbackFaqItems, localSeoLandingLinks } from "@/constants/public-content"

const localSiteUrl = "http://localhost:3002"

export const localSeoKeywords = [
  "Sadhana Boys Hostel",
  "Sadhana Hostel",
  "boys hostel in Pulivendula",
  "Pulivendula boys hostel",
  "best boys hostel in Pulivendula",
  "hostel in Pulivendula",
  "student hostel in Pulivendula",
  "student hostel Pulivendula",
  "employee hostel in Pulivendula",
  "employee hostel Pulivendula",
  "working professionals hostel Pulivendula",
  "hostel near Bakarapuram",
  "hostel near Palem Street Pulivendula",
  "hostel near Royals Road Pulivendula",
  "Pulivendula rooms for students",
  "affordable hostel Pulivendula",
]

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    noimageindex: true,
    nocache: true,
    nosnippet: true,
    notranslate: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      noimageindex: true,
      nocache: true,
      nosnippet: true,
      notranslate: true,
    },
  },
}

type PublicPageSchemaInput = {
  name: string
  description: string
  path: string
  pageType?: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage"
  image?: string
}

type BreadcrumbItem = {
  name: string
  path: string
}

type FaqItem = {
  question: string
  answer: string
}

export function getSiteUrl() {
  const configuredUrl = normalizeSiteUrlCandidate(process.env.NEXT_PUBLIC_APP_URL)
  const vercelProductionUrl = normalizeSiteUrlCandidate(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  const vercelDeploymentUrl = normalizeSiteUrlCandidate(process.env.VERCEL_URL)

  if (configuredUrl && !isLocalOrPlaceholderSiteUrl(configuredUrl)) {
    return configuredUrl
  }

  if (vercelProductionUrl) {
    return vercelProductionUrl
  }

  if (isVercelDeployment() && vercelDeploymentUrl) {
    return vercelDeploymentUrl
  }

  if (isProductionLikeEnvironment()) {
    throw new Error(
      "Cannot build public SEO URLs: configure NEXT_PUBLIC_APP_URL with the production domain or enable Vercel system environment variables."
    )
  }

  return configuredUrl ?? localSiteUrl
}

export function absoluteUrl(path = "/") {
  const siteUrl = getSiteUrl()

  if (/^https?:\/\//i.test(path)) {
    return new URL(path).toString()
  }

  return new URL(path.startsWith("/") ? path : `/${path}`, siteUrl).toString()
}

function createBreadcrumbList(items: BreadcrumbItem[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function isIndexableProductionUrl() {
  let siteUrl: string

  try {
    siteUrl = getSiteUrl()
  } catch {
    return false
  }

  return (
    isProductionLikeEnvironment() &&
    !isLocalOrPlaceholderSiteUrl(siteUrl)
  )
}

function normalizeSiteUrlCandidate(value?: string | null) {
  const rawValue = value?.trim()

  if (!rawValue) {
    return null
  }

  const withProtocol = /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`

  try {
    return new URL(withProtocol).origin
  } catch {
    return null
  }
}

function isLocalOrPlaceholderSiteUrl(value: string) {
  const hostname = new URL(value).hostname.toLowerCase()

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.includes("example.com") ||
    hostname.includes("placeholder")
  )
}

function isProductionLikeEnvironment() {
  const launchMode = process.env.NEXT_PUBLIC_LAUNCH_MODE ?? process.env.LAUNCH_MODE

  return launchMode === "production" || process.env.VERCEL_ENV === "production"
}

function isVercelDeployment() {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.VERCEL_URL) ||
    Boolean(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  )
}

export function createPublicPageJsonLd(input: PublicPageSchemaInput) {
  const siteUrl = getSiteUrl()
  const pageUrl = absoluteUrl(input.path)
  const breadcrumbItems =
    input.path === "/"
      ? [{ name: hostelConfig.name, path: "/" }]
      : [
          { name: hostelConfig.name, path: "/" },
          { name: input.name, path: input.path },
        ]

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": input.pageType ?? "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: input.name,
        description: input.description,
        inLanguage: "en-IN",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        about: {
          "@id": `${siteUrl}/#local-business`,
        },
        publisher: {
          "@id": `${siteUrl}/#local-business`,
        },
        provider: {
          "@id": `${siteUrl}/#local-business`,
        },
        breadcrumb: {
          "@id": `${pageUrl}#breadcrumb`,
        },
        ...(input.image
          ? {
              primaryImageOfPage: {
                "@type": "ImageObject",
                url: absoluteUrl(input.image),
              },
            }
          : {}),
      },
      {
        ...createBreadcrumbList(breadcrumbItems),
        "@id": `${pageUrl}#breadcrumb`,
      },
    ],
  }
}

export function createPublicMetadata(input: {
  title: string
  description: string
  path: string
  keywords?: string[]
  image?: string
}): Metadata {
  const image = absoluteUrl(input.image ?? hostelImages.hero)

  return {
    title: input.title,
    description: input.description,
    keywords: [...localSeoKeywords, ...(input.keywords ?? [])],
    alternates: {
      canonical: input.path,
      languages: {
        "en-IN": input.path,
        "x-default": input.path,
      },
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: input.path,
      siteName: hostelConfig.name,
      locale: "en_IN",
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${hostelConfig.name} in ${hostelConfig.location.city}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  }
}

export function createPublicSiteJsonLd() {
  const siteUrl = getSiteUrl()
  const businessId = `${siteUrl}/#local-business`
  const websiteId = `${siteUrl}/#website`

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["LodgingBusiness", "Hostel"],
        "@id": businessId,
        name: hostelConfig.name,
        alternateName: hostelConfig.shortName,
        url: siteUrl,
        image: [
          absoluteUrl(hostelImages.hero),
          absoluteUrl(hostelImages.exterior),
          absoluteUrl(hostelImages.gate),
        ],
        logo: absoluteUrl("/images/hostel-gate.webp"),
        telephone: `+91${hostelConfig.contact.phone}`,
        priceRange: `₹${hostelConfig.fees.student}-₹${hostelConfig.fees.employee}`,
        currenciesAccepted: "INR",
        paymentAccepted: ["Cash", "UPI"],
        knowsLanguage: ["en-IN", "te-IN"],
        description: `${hostelConfig.name} is a boys hostel in ${hostelConfig.location.city}, ${hostelConfig.location.state}, with student rooms, employee accommodation, food, WiFi, CCTV, water facilities, and parking support.`,
        address: {
          "@type": "PostalAddress",
          streetAddress: "Palem Street, Royals Road, Bakarapuram",
          addressLocality: hostelConfig.location.city,
          addressRegion: hostelConfig.location.state,
          postalCode: "516390",
          addressCountry: "IN",
        },
        areaServed: [
          hostelConfig.location.city,
          "Bakarapuram",
          "Palem Street",
          "Royals Road",
          "Pulivendula Andhra Pradesh",
        ],
        hasMap: hostelConfig.links.mapSearchHref,
        sameAs: [hostelConfig.links.mapSearchHref],
        potentialAction: [
          {
            "@type": "CommunicateAction",
            target: absoluteUrl("/contact"),
            name: "Ask Sadhana Boys Hostel joining details",
          },
          {
            "@type": "CommunicateAction",
            target: hostelConfig.links.whatsappHref,
            name: "Message Sadhana Boys Hostel on WhatsApp",
          },
        ],
        amenityFeature: [
          "Food",
          "WiFi",
          "CCTV",
          "Water facility",
          "Parking",
          "Student accommodation",
          "Employee accommodation",
        ].map((name) => ({
          "@type": "LocationFeatureSpecification",
          name,
          value: true,
        })),
        makesOffer: [
          {
            "@type": "Offer",
            name: "Student hostel accommodation",
            price: hostelConfig.fees.student,
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
            url: absoluteUrl("/contact"),
          },
          {
            "@type": "Offer",
            name: "Employee hostel accommodation",
            price: hostelConfig.fees.employee,
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
            url: absoluteUrl("/contact"),
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: hostelConfig.name,
        alternateName: hostelConfig.shortName,
        url: siteUrl,
        inLanguage: "en-IN",
        publisher: {
          "@id": businessId,
        },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: hostelConfig.name,
        url: siteUrl,
        logo: absoluteUrl("/images/hostel-gate.webp"),
        contactPoint: [
          {
            "@type": "ContactPoint",
            telephone: `+91${hostelConfig.contact.phone}`,
            contactType: "customer service",
            areaServed: "IN",
            availableLanguage: ["en", "te"],
          },
        ],
      },
    ],
  }
}

export function createRoomsOfferCatalogJsonLd() {
  const roomsUrl = absoluteUrl("/rooms")
  const siteUrl = getSiteUrl()

  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "@id": `${roomsUrl}#room-offers`,
    name: `${hostelConfig.name} room fees in ${hostelConfig.location.city}`,
    description: `Student hostel rooms are ₹${hostelConfig.fees.student}/month and employee accommodation is ₹${hostelConfig.fees.employee}/month at ${hostelConfig.name} in ${hostelConfig.location.city}.`,
    url: roomsUrl,
    itemListElement: [
      {
        "@type": "Offer",
        name: "Student hostel rooms in Pulivendula",
        description: `Student boys hostel accommodation at ₹${hostelConfig.fees.student}/month near ${hostelConfig.location.note}.`,
        price: hostelConfig.fees.student,
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
        url: roomsUrl,
        areaServed: hostelConfig.location.city,
        offeredBy: {
          "@id": `${siteUrl}/#local-business`,
        },
        itemOffered: {
          "@type": "Accommodation",
          name: "Student hostel room",
          accommodationCategory: "Hostel room",
        },
      },
      {
        "@type": "Offer",
        name: "Employee hostel accommodation in Pulivendula",
        description: `Working professional and employee hostel accommodation at ₹${hostelConfig.fees.employee}/month near ${hostelConfig.location.note}.`,
        price: hostelConfig.fees.employee,
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
        url: roomsUrl,
        areaServed: hostelConfig.location.city,
        offeredBy: {
          "@id": `${siteUrl}/#local-business`,
        },
        itemOffered: {
          "@type": "Accommodation",
          name: "Employee hostel accommodation",
          accommodationCategory: "Hostel accommodation",
        },
      },
    ],
  }
}

export function createAccommodationOfferJsonLd(input: {
  name: string
  description: string
  path: string
  price: number
  accommodationName: string
}) {
  const siteUrl = getSiteUrl()
  const pageUrl = absoluteUrl(input.path)

  return {
    "@context": "https://schema.org",
    "@type": "Offer",
    "@id": `${pageUrl}#offer`,
    name: input.name,
    description: input.description,
    price: input.price,
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    url: pageUrl,
    areaServed: hostelConfig.location.city,
    offeredBy: {
      "@id": `${siteUrl}/#local-business`,
    },
    itemOffered: {
      "@type": "Accommodation",
      name: input.accommodationName,
      accommodationCategory: "Hostel accommodation",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Palem Street, Royals Road, Bakarapuram",
        addressLocality: hostelConfig.location.city,
        addressRegion: hostelConfig.location.state,
        postalCode: "516390",
        addressCountry: "IN",
      },
    },
  }
}

export function createFaqJsonLd(items: readonly FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }
}

export function createHomeFaqJsonLd() {
  return createFaqJsonLd(fallbackFaqItems)
}

export function createLocalLandingPagesItemListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${hostelConfig.name} local hostel pages`,
    itemListElement: localSeoLandingLinks.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      description: item.description,
      url: absoluteUrl(item.href),
    })),
  }
}
