/**
 * LocalBusiness structured data (schema.org RoofingContractor) — what Google
 * reads to understand who the business is, where it is and when it's open.
 *
 * Deliberately NOT included: an aggregateRating. Google ignores star ratings
 * a business publishes about itself, and a made-up number here is worse than
 * none. Real stars come from the Google Business Profile.
 */
import { business } from "./business";
import { services } from "./content";
import { siteUrl } from "./site";

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "RoofingContractor",
    "@id": `${siteUrl}/#business`,
    name: business.name,
    slogan: business.tagline,
    description: `${business.tagline} serving ${business.serviceArea}, FL. Roof replacement, repairs, inspections, storm damage and insurance claim documentation.`,
    url: siteUrl,
    telephone: business.phoneE164,
    image: `${siteUrl}/images/placeholder-hero-roofer.jpg`,
    logo: `${siteUrl}/icon.svg`,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address.street,
      addressLocality: business.address.city,
      addressRegion: business.address.region,
      postalCode: business.address.postalCode,
      addressCountry: business.address.country,
    },
    hasMap: business.mapsUrl,
    areaServed: {
      "@type": "City",
      name: `${business.serviceArea}, FL`,
    },
    openingHoursSpecification: business.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    ...(business.licenseNumber ? { hasCredential: { "@type": "EducationalOccupationalCredential", credentialCategory: "license", name: `Florida roofing license ${business.licenseNumber}` } } : {}),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Roofing services",
      itemListElement: services.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.title, description: s.body, areaServed: business.serviceArea },
      })),
    },
  };
}
