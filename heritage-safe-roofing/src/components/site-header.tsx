import { business } from "@/lib/business";
import { PhoneIcon } from "./icons";
import { Logo } from "./logo";

const nav = [
  { href: "#services", label: "Services" },
  { href: "#why-us", label: "Why us" },
  { href: "#reviews", label: "Reviews" },
  { href: "#storm-damage", label: "Storm damage" },
  { href: "#service-area", label: "Service area" },
];

/** The bar across the top: logo, section links on wide screens, and the phone. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#top" className="rounded-md">
          <Logo />
        </a>

        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-[0.95rem] font-semibold text-navy-800">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="py-2 hover:text-gold-800 hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <a
          href={business.phoneHref}
          className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg bg-navy-900 px-3 font-display font-bold text-white transition-colors hover:bg-navy-700 sm:px-4"
          aria-label={`Call ${business.name} at ${business.phoneDisplay}`}
        >
          <PhoneIcon className="h-5 w-5 text-gold-400" />
          <span className="hidden sm:inline">{business.phoneDisplay}</span>
        </a>
      </div>
    </header>
  );
}
