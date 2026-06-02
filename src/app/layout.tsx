import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/app-providers";
import { absoluteUrl, getSiteUrl, localSeoKeywords } from "@/lib/seo";
import "./globals.css";

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Sadhana Boys Hostel Pulivendula | Student & Employee Hostel",
    template: "%s | Sadhana Boys Hostel Pulivendula",
  },
  description:
    "Sadhana Boys Hostel in Pulivendula offers student rooms, employee accommodation, food, WiFi, CCTV, water facilities, parking support, and clear monthly pricing.",
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
    title: "Sadhana Boys Hostel Pulivendula | Student & Employee Hostel",
    description:
      "Safe, neat, and affordable boys hostel accommodation for students and working professionals in Pulivendula.",
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
    title: "Sadhana Boys Hostel Pulivendula",
    description:
      "Student and employee hostel in Pulivendula with food, WiFi, CCTV, water, and parking support.",
    images: [absoluteUrl("/images/hostel-exterior-wide.webp")],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" className="h-full antialiased">
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
