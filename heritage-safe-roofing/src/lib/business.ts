/**
 * Everything the site says about the business lives here, so updating a
 * phone number, hours or licence number is a one-file change.
 *
 * Anything marked PLACEHOLDER was not supplied and still needs a real value.
 * See PLACEHOLDERS.md at the project root for the full checklist.
 */

export const business = {
  name: "Heritage Safe Roofing",
  tagline: "Licensed & Insured Roofing Contractors",

  phoneDisplay: "(754) 298-2345",
  phoneHref: "tel:+17542982345",
  phoneE164: "+17542982345",

  address: {
    street: "4760 NE 27th Ave",
    city: "Fort Lauderdale",
    region: "FL",
    postalCode: "33308",
    country: "US",
  },
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=4760+NE+27th+Ave+Fort+Lauderdale+FL+33308",

  serviceArea: "Fort Lauderdale",

  // PLACEHOLDER: real opening hours. Also feeds the Google structured data.
  hours: [
    { label: "Monday – Friday", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "07:00", closes: "18:00", display: "7:00 AM – 6:00 PM" },
    { label: "Saturday", days: ["Saturday"], opens: "08:00", closes: "14:00", display: "8:00 AM – 2:00 PM" },
  ],
  closedNote: "Sunday: closed", // PLACEHOLDER

  // PLACEHOLDER: Florida roofing licence, e.g. "CCC1234567". Leave empty
  // and the site simply says "State-licensed" without a number.
  licenseNumber: "",

  // PLACEHOLDER: the real Google rating and review count, and the link to
  // the Google Business Profile reviews page.
  google: {
    rating: "5.0",
    reviewCount: "", // e.g. "48". Empty hides the count.
    reviewsUrl: "https://www.google.com/search?q=Heritage+Safe+Roofing+Fort+Lauderdale+reviews",
  },

  // PLACEHOLDER: warranty length is not known yet, so the copy stays
  // general. Put e.g. "10-year" here to name it on the page.
  workmanshipWarranty: "",
} as const;

export type Business = typeof business;

export const fullAddress = `${business.address.street}, ${business.address.city}, ${business.address.region} ${business.address.postalCode}`;

// Small tag shown on every stock photo so nobody mistakes it for their own
// work. Flip to false once the real photos are in.
export const SHOW_PLACEHOLDER_PHOTO_TAGS = true;
