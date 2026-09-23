/**
 * The words on the page that aren't contact details: services, reasons,
 * reviews and neighbourhoods. Kept apart from the layout so copy edits
 * never mean touching markup.
 */

export type ServiceIcon = "home" | "wrench" | "search" | "storm" | "clipboard" | "gutter";

export const services: { title: string; body: string; icon: ServiceIcon }[] = [
  {
    title: "Roof Replacement",
    body: "Shingle, tile, metal and flat roofs. Full tear-off, new decking wherever the old wood is soft, and a finished roof installed to Florida Building Code.",
    icon: "home",
  },
  {
    title: "Roof Repair & Leaks",
    body: "Missing shingles, cracked tiles, failed flashing, stains on the ceiling. We find where the water is really getting in before we fix anything.",
    icon: "wrench",
  },
  {
    title: "Free Roof Inspections",
    body: "A full walk of your roof with photos of what we see, so you know whether you need a repair, a replacement, or nothing at all.",
    icon: "search",
  },
  {
    title: "Storm & Hurricane Damage",
    body: "Lifted shingles, blown-off tiles and wind-driven leaks after a storm. We document the damage and get your home watertight.",
    icon: "storm",
  },
  {
    title: "Insurance Claim Documentation",
    body: "Photos, measurements and a written damage report you can hand to your insurer, and a roofer on site when the adjuster comes out.",
    icon: "clipboard",
  },
  {
    title: "Gutters, Soffits & Skylights",
    body: "New gutters and soffits to finish the roofline, and skylights installed and flashed so they let in light, not water.",
    icon: "gutter",
  },
];

export type ReasonIcon = "shield" | "receipt" | "pin" | "award" | "bolt";

export const reasons: { title: string; body: string; icon: ReasonIcon }[] = [
  {
    title: "Licensed",
    body: "A state-licensed Florida roofing contractor, permitted and inspected on every job.",
    icon: "shield",
  },
  {
    title: "Insured",
    body: "If something goes wrong on your property, it's covered by us, not you. Ask and we'll send the certificate before work starts.",
    icon: "receipt",
  },
  {
    title: "Local",
    body: "Based on NE 27th Ave in Fort Lauderdale. We're here after the storm season, not just during it.",
    icon: "pin",
  },
  {
    title: "Warranty",
    body: "Our workmanship is backed in writing, on top of the manufacturer's warranty on your materials.",
    icon: "award",
  },
  {
    title: "Fast response",
    body: "We pick up the phone, get out to look quickly, and keep you updated from the first visit to the final cleanup.",
    icon: "bolt",
  },
];

export const reviews = [
  {
    pull: "They did not cut corners.",
    project: "New roof, gutters & soffits",
    // PLACEHOLDER: reviewer's name as it appears on Google.
    author: "",
    body: "Sebastian was great to work with on our roofing project in Fort Lauderdale. He explained the roof work clearly, went over the pricing up front, and answered all of our questions from start to finish. He also followed up during the job and made sure everything stayed on track. We are very happy with our new roof, gutters, and soffits. The roofing crew was thorough, professional, and efficient, and they paid close attention to the details. Even though the quote was not the lowest, the quality of the roofing work and the extra care they put into the job made the choice easy for us. They did not cut corners, used solid materials, and clearly took pride in their workmanship and reputation. Good roofing service like this can be hard to find, and we are very glad we got the recommendation.",
  },
  {
    pull: "Finished our project in just three days.",
    project: "Complex multi-pitch shingle roof, new decking",
    author: "",
    body: "The roofing crew came out and finished our project in just three days! We had been looking for roofers in Fort Lauderdale for a while and even tried starting the job ourselves since we knew about roofing materials and have some experience. Raymond was really quick to respond and assured us he could take care of everything, even with his busy schedule. He took on our complicated roof with multiple pitches from years of home additions, and some areas had old shakes under shingles, while others had several layers and needed all new decking. Despite all these challenges, the team handled it all and gave us a beautiful new shingle roof. They worked with us to stay within our budget, which made us feel secure moving ahead. Overall, a fantastic experience with a reliable roofing team!",
  },
  {
    pull: "My yard was completely clean.",
    project: "New roof & three skylights",
    author: "",
    body: "I had a new roof and three skylights installed, and I couldn't be happier with how everything turned out. I got estimates from three different roofing companies, and this team stood out not just for their competitive pricing but also for their professionalism and attention to detail. They were always accommodating, kept in touch throughout the process, and proved to be very reliable. Marvin and the crew worked hard in the Florida heat, showing real pride in their craftsmanship. After finishing, they made sure my yard was completely clean with no leftover materials. The roof looks fantastic, and I highly recommend their roofing services to anyone needing a new roof or skylights.",
  },
];

export const stormSteps = [
  {
    title: "Call, or book online",
    body: "Tell us what happened. If water is coming in, say so and we'll prioritise you.",
  },
  {
    title: "We inspect and document",
    body: "Photos, measurements and a written report of every bit of damage we find, yours to keep.",
  },
  {
    title: "We meet your adjuster",
    body: "If you'd like, we'll be on the roof when your insurance adjuster inspects, so nothing gets missed.",
  },
  {
    title: "We repair or replace",
    body: "Once you're ready, we schedule the work, keep you updated, and leave the yard clean.",
  },
];

// Neighbourhoods inside the City of Fort Lauderdale.
export const neighborhoods = [
  "Coral Ridge",
  "Coral Ridge Isles",
  "Imperial Point",
  "Galt Ocean Mile",
  "Bermuda Riviera",
  "Lake Ridge",
  "Poinsettia Heights",
  "Middle River Terrace",
  "Victoria Park",
  "Las Olas Isles",
  "Colee Hammock",
  "Rio Vista",
  "Harbor Beach",
  "Sailboat Bend",
  "Tarpon River",
  "Riverland",
];
