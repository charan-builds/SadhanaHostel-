import type { Metadata, Viewport } from "next";
import { GoogleAnalyticsSlot } from "@/components/analytics/google-analytics-slot";
import { absoluteUrl, getSiteUrl, localSeoKeywords } from "@/lib/seo";
import "./globals.css";

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Sadhana Boys Hostel | Tirupati Region Student & Employee Hostel",
    template: "%s | Sadhana Boys Hostel",
  },
  description:
    "Sadhana Boys Hostel serves students and employees searching for boys hostel accommodation in the Tirupati region with food, WiFi, CCTV, water facilities, parking support, and clear monthly pricing.",
  applicationName: "Sadhana Boys Hostel",
  keywords: localSeoKeywords,
  authors: [{ name: "Sadhana Boys Hostel" }],
  creator: "Sadhana Boys Hostel",
  publisher: "Sadhana Boys Hostel",
  category: "hostel accommodation",
  manifest: "/manifest.webmanifest",
  ...(googleSiteVerification
    ? {
        verification: {
          google: googleSiteVerification,
        },
      }
    : {}),
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Sadhana Hostel",
    "geo.region": "IN-AP",
    "geo.placename": "Pulivendula",
    "business:contact_data:locality": "Pulivendula",
    "business:contact_data:region": "Andhra Pradesh",
    "business:contact_data:country_name": "India",
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-IN": "/",
      "x-default": "/",
    },
  },
  openGraph: {
    title: "Sadhana Boys Hostel | Tirupati Region Student & Employee Hostel",
    description:
      "Safe, neat, and affordable boys hostel accommodation for students and working professionals searching in the Tirupati region.",
    url: "/",
    siteName: "Sadhana Boys Hostel",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: absoluteUrl("/images/hostel-exterior-wide.webp"),
        width: 1200,
        height: 630,
        alt: "Sadhana Boys Hostel building in Pulivendula",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sadhana Boys Hostel Tirupati Region",
    description:
      "Student and employee hostel accommodation with food, WiFi, CCTV, water, and parking support.",
    images: [absoluteUrl("/images/hostel-exterior-wide.webp")],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0068b7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
      <GoogleAnalyticsSlot />
    </html>
  );
}
