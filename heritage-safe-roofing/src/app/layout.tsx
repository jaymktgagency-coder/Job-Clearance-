/**
 * The frame around every page: fonts, the <head> tags Google and social
 * apps read, and the LocalBusiness structured data.
 */
import type { Metadata, Viewport } from "next";
import { Archivo, Source_Sans_3 } from "next/font/google";
import { business } from "@/lib/business";
import { localBusinessJsonLd } from "@/lib/schema";
import { siteUrl } from "@/lib/site";
import "./globals.css";

// Archivo at a wide setting reads like painted truck signage; Source Sans 3
// stays legible at phone sizes in bright sun. Both self-hosted by Next.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

const title = "Fort Lauderdale Roofing Contractor | Heritage Safe Roofing";
const description =
  "Licensed & insured roofers in Fort Lauderdale, FL. Roof replacement, roof repair, free roof inspections and storm damage help. Call (754) 298-2345.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "roofing contractor Fort Lauderdale",
    "roofers Fort Lauderdale",
    "roof replacement Fort Lauderdale",
    "roof repair Fort Lauderdale",
    "roof inspection Fort Lauderdale",
    "storm damage roof repair",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: business.name,
    title,
    description,
    images: [{ url: "/images/placeholder-hero-roofer.jpg", width: 2000, height: 1333, alt: "Roofer working on a shingle roof" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/images/placeholder-hero-roofer.jpg"] },
  formatDetection: { telephone: true, address: true },
  other: {
    "geo.region": "US-FL",
    "geo.placename": "Fort Lauderdale",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1c38",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${sourceSans.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessJsonLd()).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
