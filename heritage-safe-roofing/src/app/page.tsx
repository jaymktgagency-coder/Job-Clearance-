/**
 * The whole site: one page, top to bottom in the order a homeowner decides —
 * who are you, what do you do, why you, who says so, storm help, do you
 * come to me, how do I reach you.
 */
import Image from "next/image";
import { ContactForm } from "@/components/contact-form";
import {
  ArrowRightIcon,
  AwardIcon,
  BoltIcon,
  ClipboardIcon,
  ClockIcon,
  GoogleG,
  GutterIcon,
  HomeIcon,
  MapPinIcon,
  PhoneIcon,
  ReceiptIcon,
  SearchIcon,
  ShieldCheckIcon,
  StormIcon,
  WrenchIcon,
} from "@/components/icons";
import { Logo } from "@/components/logo";
import { PhotoTag } from "@/components/photo-tag";
import { SiteHeader } from "@/components/site-header";
import { Stars } from "@/components/stars";
import { StickyCall } from "@/components/sticky-call";
import { business, fullAddress } from "@/lib/business";
import { neighborhoods, reasons, reviews, services, stormSteps, type ReasonIcon, type ServiceIcon } from "@/lib/content";

// PLACEHOLDER PHOTOS (Unsplash, free licence). Replace each file in
// public/images/ with a real job photo of the same name and the page updates.
import heroPhoto from "../../public/images/placeholder-hero-roofer.jpg";
import crewPhoto from "../../public/images/placeholder-crew-on-roof.jpg";
import stormPhoto from "../../public/images/placeholder-storm.jpg";
import homePhoto from "../../public/images/placeholder-florida-home.jpg";

const serviceIcons: Record<ServiceIcon, typeof HomeIcon> = {
  home: HomeIcon,
  wrench: WrenchIcon,
  search: SearchIcon,
  storm: StormIcon,
  clipboard: ClipboardIcon,
  gutter: GutterIcon,
};

const reasonIcons: Record<ReasonIcon, typeof HomeIcon> = {
  shield: ShieldCheckIcon,
  receipt: ReceiptIcon,
  pin: MapPinIcon,
  award: AwardIcon,
  bolt: BoltIcon,
};

const container = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

function CallButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={business.phoneHref}
      className={`inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-gold-500 px-6 font-display text-lg font-bold text-navy-900 shadow-[0_10px_24px_-12px_rgb(232_163_61/0.9)] transition-[background-color,translate] duration-200 ease-out hover:-translate-y-0.5 hover:bg-gold-400 active:translate-y-0 ${className}`}
    >
      <PhoneIcon className="h-5 w-5" />
      <span>
        Call <span className="whitespace-nowrap">{business.phoneDisplay}</span>
      </span>
    </a>
  );
}

export default function Home() {
  const [featured, ...moreReviews] = reviews;
  const licence = business.licenseNumber ? `FL License #${business.licenseNumber}` : "State-licensed in Florida";

  return (
    <>
      <SiteHeader />
      <main id="top" className="pb-20 md:pb-0">
        {/* ─── 1. Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-navy-900 text-white">
          <div className="lg:grid lg:min-h-[640px] lg:grid-cols-[1.1fr_1fr]">
            <div className={`${container} flex flex-col justify-center py-12 sm:py-16 lg:mr-0 lg:max-w-none lg:py-20 lg:pr-4 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))]`}>
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-gold-500/60 bg-navy-800 px-3.5 py-1.5 text-sm font-semibold text-gold-300">
                <ShieldCheckIcon className="h-4.5 w-4.5" />
                Licensed &amp; Insured Roofing Contractors
              </p>

              <svg viewBox="0 0 80 26" className="ridge-line mt-8 h-6 w-[74px] text-gold-500" aria-hidden="true">
                <path d="M3 23 40 4l37 19" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
              </svg>
              <h1 className="mt-3 max-w-[15ch] text-[2.6rem] font-extrabold [font-stretch:108%] sm:text-6xl lg:text-[4.1rem]">
                Fort Lauderdale roofers who don&rsquo;t cut corners.
              </h1>
              <p className="mt-5 max-w-[46ch] text-lg text-on-navy-soft sm:text-xl">
                Roof replacement, repairs and storm damage for Fort Lauderdale homes, with the price explained up front
                and a crew that cleans up before it leaves.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CallButton />
                <a
                  href="#contact"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-white/80 px-6 font-display text-lg font-bold text-white transition-colors hover:bg-white hover:text-navy-900"
                >
                  Get a free inspection
                  <ArrowRightIcon className="h-5 w-5" />
                </a>
              </div>

              <a href="#reviews" className="group mt-8 inline-flex w-fit items-center gap-3 text-sm">
                <GoogleG className="h-5 w-5" />
                <Stars />
                <span className="font-semibold text-white group-hover:underline">
                  {business.google.rating} on Google
                  {business.google.reviewCount && <span className="font-normal text-on-navy-soft"> · {business.google.reviewCount} reviews</span>}
                </span>
              </a>
            </div>

            <div className="relative h-72 sm:h-96 lg:h-auto">
              <Image
                src={heroPhoto}
                alt="Roofer in a safety harness working on a shingle roof"
                fill
                sizes="(min-width: 1024px) 48vw, 100vw"
                className="pitch-clip object-cover object-[60%_40%]"
                placeholder="blur"
                loading="eager"
              />
              <PhotoTag className="right-3 bottom-3" />
            </div>
          </div>
        </section>

        {/* ─── 2. Services ─────────────────────────────────────── */}
        <section id="services" className="py-16 sm:py-24">
          <div className={`${container} grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16`}>
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className="text-4xl font-extrabold sm:text-5xl">Every roof job, start to finish.</h2>
              <p className="mt-5 max-w-[48ch] text-lg text-ink-soft">
                One crew for the whole roof, from the first inspection to the last nail swept off your driveway. Not sure
                which of these you need? That&rsquo;s what the free inspection is for.
              </p>
              <div className="relative mt-8 hidden aspect-[4/3] overflow-hidden rounded-xl lg:block">
                <Image
                  src={crewPhoto}
                  alt="Roofer standing on a pitched roof during a job"
                  fill
                  sizes="40vw"
                  className="object-cover"
                  placeholder="blur"
                />
                <PhotoTag className="top-3 left-3" />
              </div>
            </div>

            <ul className="grid border-t border-line sm:grid-cols-2">
              {services.map((s, i) => {
                const Icon = serviceIcons[s.icon];
                return (
                  <li
                    key={s.title}
                    className={`border-b border-line py-7 sm:py-8 ${i % 2 === 0 ? "sm:pr-8" : "sm:border-l sm:pl-8"}`}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-navy-900 text-gold-400">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="mt-5 text-[1.4rem] font-bold">{s.title}</h3>
                    <p className="mt-2 text-ink-soft">{s.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ─── 3. Why choose us ────────────────────────────────── */}
        <section id="why-us" className="bg-navy-900 py-16 text-white sm:py-24">
          <div className={container}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="max-w-[18ch] text-4xl font-extrabold sm:text-5xl">
                Why Fort Lauderdale homeowners call Heritage Safe.
              </h2>
              <p className="flex items-center gap-2.5 font-semibold text-gold-300">
                <ShieldCheckIcon className="h-5 w-5" />
                {licence} · Fully insured
              </p>
            </div>

            <ul className="mt-12 grid gap-px overflow-hidden rounded-xl bg-navy-700 sm:grid-cols-2 lg:grid-cols-5">
              {reasons.map((r) => {
                const Icon = reasonIcons[r.icon];
                const body =
                  r.icon === "award" && business.workmanshipWarranty
                    ? `A ${business.workmanshipWarranty} workmanship warranty in writing, on top of the manufacturer's warranty on your materials.`
                    : r.body;
                return (
                  <li key={r.title} className="bg-navy-900 p-6 sm:p-7 lg:last:col-span-1 sm:last:col-span-2">
                    <Icon className="h-8 w-8 text-gold-400" />
                    <h3 className="mt-5 text-xl font-bold">{r.title}</h3>
                    <p className="mt-2 text-on-navy-soft">{body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ─── 4. Reviews ──────────────────────────────────────── */}
        <section id="reviews" className="bg-sand py-16 sm:py-24">
          <div className={container}>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <h2 className="max-w-[16ch] text-4xl font-extrabold sm:text-5xl">In our customers&rsquo; own words.</h2>
              <a
                href={business.google.reviewsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-fit items-center gap-4 rounded-xl bg-white px-5 py-4 shadow-[0_10px_30px_-18px_rgb(11_28_56/0.45)]"
              >
                <GoogleG className="h-9 w-9" />
                <span>
                  <span className="flex items-center gap-2">
                    <span className="font-display text-3xl leading-none font-extrabold">{business.google.rating}</span>
                    <Stars className="h-5 w-5" />
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-ink-soft group-hover:text-ink group-hover:underline">
                    {business.google.reviewCount ? `${business.google.reviewCount} Google reviews` : "Rated on Google"} · Read them all
                  </span>
                </span>
              </a>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <figure className="rounded-xl bg-navy-900 p-7 text-white sm:p-10 lg:row-span-2">
                <Stars className="h-5 w-5" />
                <blockquote className="mt-6">
                  <p className="font-display text-3xl leading-tight font-extrabold sm:text-4xl">&ldquo;{featured.pull}&rdquo;</p>
                  <p className="mt-6 text-lg leading-relaxed text-on-navy-soft">{featured.body}</p>
                </blockquote>
                <figcaption className="mt-7 border-t border-navy-700 pt-5 text-sm">
                  <span className="font-semibold text-white">{featured.author || "Google review"}</span>
                  <span className="text-on-navy-soft"> · {featured.project}</span>
                </figcaption>
              </figure>

              {moreReviews.map((r) => (
                <figure key={r.pull} className="rounded-xl bg-white p-7 shadow-[0_10px_30px_-20px_rgb(11_28_56/0.4)] sm:p-9">
                  <Stars />
                  <blockquote className="mt-5">
                    <p className="font-display text-2xl leading-tight font-bold">&ldquo;{r.pull}&rdquo;</p>
                    <p className="mt-4 text-ink-soft">{r.body}</p>
                  </blockquote>
                  <figcaption className="mt-6 border-t border-line pt-4 text-sm">
                    <span className="font-semibold">{r.author || "Google review"}</span>
                    <span className="text-ink-soft"> · {r.project}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 5. Storm damage & insurance ─────────────────────── */}
        <section id="storm-damage" className="relative isolate overflow-hidden bg-navy-950 py-16 text-white sm:py-24">
          <Image
            src={stormPhoto}
            alt=""
            fill
            sizes="100vw"
            className="-z-20 object-cover opacity-40"
            placeholder="blur"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-950/70 via-navy-950/85 to-navy-950" />
          <PhotoTag className="top-3 right-3" />

          <div className={`${container} grid gap-12 lg:grid-cols-2 lg:gap-16`}>
            <div>
              <StormIcon className="h-10 w-10 text-gold-400" />
              <h2 className="mt-5 max-w-[16ch] text-4xl font-extrabold sm:text-5xl">
                Storm damage? Start with a phone call.
              </h2>
              <p className="mt-5 max-w-[48ch] text-lg text-on-navy-soft">
                After a hurricane or a hard summer storm, the damage you can see from the yard is rarely all of it. We
                get on the roof, document everything properly, and give you a clear record to take to your insurance
                company.
              </p>
              <ul className="mt-6 space-y-2.5 text-white">
                {["Wind-lifted and missing shingles or tiles", "Leaks and water stains after heavy rain", "Damaged flashing, vents, gutters and soffits"].map((t) => (
                  <li key={t} className="flex gap-3">
                    <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
                    {t}
                  </li>
                ))}
              </ul>
              <CallButton className="mt-9 w-full sm:w-auto" />
            </div>

            <div>
              <h3 className="text-2xl font-bold">How an insurance claim works with us</h3>
              <ol className="mt-6 space-y-0">
                {stormSteps.map((step, i) => (
                  <li key={step.title} className="relative flex gap-5 pb-7 last:pb-0">
                    {i < stormSteps.length - 1 && (
                      <span className="absolute top-11 bottom-1 left-[1.3rem] w-px bg-navy-600" aria-hidden="true" />
                    )}
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-500 font-display text-lg font-extrabold text-navy-900">
                      {i + 1}
                    </span>
                    <div className="pt-1.5">
                      <h4 className="font-display text-lg font-bold">{step.title}</h4>
                      <p className="mt-1 text-on-navy-soft">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Florida Statute 489.147 notice. Have the owner/attorney confirm wording. */}
              <p className="mt-9 border-t border-navy-700 pt-5 text-sm leading-relaxed text-on-navy-soft">
                We are roofers, not public adjusters: we document damage and can meet your adjuster, but we don&rsquo;t
                interpret your policy or negotiate your claim. You are responsible for paying any insurance deductible.
                It is insurance fraud punishable as a third-degree felony to intentionally file an insurance claim
                containing any false, incomplete, or misleading information.
              </p>
            </div>
          </div>
        </section>

        {/* ─── 6. Service area ─────────────────────────────────── */}
        <section id="service-area" className="py-16 sm:py-24">
          <div className={`${container} grid items-center gap-12 lg:grid-cols-2 lg:gap-16`}>
            <div className="relative order-last aspect-[4/3] overflow-hidden rounded-xl lg:order-first lg:aspect-[5/6]">
              <Image
                src={homePhoto}
                alt="White South Florida home with palm trees"
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
                placeholder="blur"
              />
              <PhotoTag className="top-3 left-3" />
            </div>

            <div>
              <h2 className="text-4xl font-extrabold sm:text-5xl">Roofing across Fort Lauderdale.</h2>
              <p className="mt-5 max-w-[50ch] text-lg text-ink-soft">
                We work throughout the City of Fort Lauderdale, from the beach to the river. Our shop is on NE 27th
                Avenue, so for most jobs we&rsquo;re a short drive away.
              </p>

              <h3 className="mt-9 font-display text-base font-bold tracking-wide text-gold-800 uppercase">
                Neighborhoods we serve
              </h3>
              <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
                {neighborhoods.map((n) => (
                  <li key={n} className="flex items-center gap-2">
                    <MapPinIcon className="h-4 w-4 shrink-0 text-gold-600" />
                    {n}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-ink-soft">
                Don&rsquo;t see your neighborhood?{" "}
                <a href={business.phoneHref} className="font-semibold text-navy-800 underline hover:text-gold-800">
                  Call and ask
                </a>
                . If it&rsquo;s in Fort Lauderdale, we can get there.
              </p>

              <a
                href={business.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 flex items-start gap-4 rounded-xl border border-line bg-white p-5 transition-colors hover:border-navy-600"
              >
                <MapPinIcon className="mt-0.5 h-6 w-6 shrink-0 text-navy-800" />
                <span>
                  <span className="block font-bold">{business.name}</span>
                  <span className="block text-ink-soft">{fullAddress}</span>
                  <span className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-800 underline">
                    Get directions <ArrowRightIcon className="h-4 w-4" />
                  </span>
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* ─── 7. Contact ──────────────────────────────────────── */}
        <section id="contact" className="border-t border-line bg-navy-100 py-16 sm:py-24">
          <div className={`${container} grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16`}>
            <div>
              <h2 className="text-4xl font-extrabold sm:text-5xl">Book your free roof inspection.</h2>
              <p className="mt-5 max-w-[46ch] text-lg text-ink-soft">
                Tell us where the roof is and what&rsquo;s going on. We&rsquo;ll call you back to set a time, come out,
                and show you exactly what we find.
              </p>

              <dl className="mt-10 space-y-6">
                <div className="flex gap-4">
                  <dt>
                    <span className="sr-only">Phone</span>
                    <PhoneIcon className="mt-1 h-6 w-6 text-navy-800" />
                  </dt>
                  <dd>
                    <a href={business.phoneHref} className="font-display text-2xl font-extrabold text-navy-900 hover:underline">
                      {business.phoneDisplay}
                    </a>
                    <span className="block text-ink-soft">Fastest way to reach us</span>
                  </dd>
                </div>
                <div className="flex gap-4">
                  <dt>
                    <span className="sr-only">Address</span>
                    <MapPinIcon className="mt-1 h-6 w-6 text-navy-800" />
                  </dt>
                  <dd>
                    {business.address.street}
                    <br />
                    {business.address.city}, {business.address.region} {business.address.postalCode}
                  </dd>
                </div>
                <div className="flex gap-4">
                  <dt>
                    <span className="sr-only">Hours</span>
                    <ClockIcon className="mt-1 h-6 w-6 text-navy-800" />
                  </dt>
                  <dd>
                    {business.hours.map((h) => (
                      <span key={h.label} className="block">
                        {h.label}: <span className="tabular-nums">{h.display}</span>
                      </span>
                    ))}
                    <span className="block text-ink-soft">{business.closedNote}</span>
                  </dd>
                </div>
              </dl>
            </div>

            <ContactForm />
          </div>
        </section>
      </main>

      {/* ─── 8. Footer ─────────────────────────────────────────── */}
      <footer className="bg-navy-950 pt-14 pb-28 text-on-navy-soft md:pb-10">
        <div className={`${container} grid gap-10 sm:grid-cols-2 lg:grid-cols-4`}>
          <div className="lg:col-span-1">
            <Logo tone="dark" />
            <p className="mt-4 max-w-[30ch]">{business.tagline}, serving {business.serviceArea}, Florida.</p>
          </div>
          <div>
            <h2 className="font-display text-sm font-bold tracking-wider text-white uppercase">Call</h2>
            <a href={business.phoneHref} className="mt-3 block font-display text-xl font-bold text-gold-400 hover:underline">
              {business.phoneDisplay}
            </a>
          </div>
          <div>
            <h2 className="font-display text-sm font-bold tracking-wider text-white uppercase">Visit</h2>
            <address className="mt-3 not-italic">
              <a href={business.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
                {business.address.street}
                <br />
                {business.address.city}, {business.address.region} {business.address.postalCode}
              </a>
            </address>
          </div>
          <div>
            <h2 className="font-display text-sm font-bold tracking-wider text-white uppercase">Hours</h2>
            <ul className="mt-3 space-y-1">
              {business.hours.map((h) => (
                <li key={h.label}>
                  {h.label}: <span className="tabular-nums">{h.display}</span>
                </li>
              ))}
              <li>{business.closedNote}</li>
            </ul>
          </div>
        </div>
        <div className={`${container} mt-12 flex flex-col gap-2 border-t border-navy-800 pt-6 text-sm sm:flex-row sm:justify-between`}>
          <p>
            © {new Date().getFullYear()} {business.name}. {licence}.
          </p>
          <p>Fully licensed &amp; insured.</p>
        </div>
      </footer>

      <StickyCall />
    </>
  );
}
