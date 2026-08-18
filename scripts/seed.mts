/**
 * seed.ts — fills your database with realistic fake data so you can click around.
 *
 * WHAT IT DOES
 * Wipes any previous demo data, then creates companies, locations, employers,
 * vouchers, seekers, jobs, intro requests, and vouches — covering the states
 * you'll actually need to look at: a verified company and an unverified one, a
 * seeker who has hit the cap of 5, both kinds of vouch, and candidates at
 * several stages.
 *
 * HOW TO RUN IT
 *   npm run seed
 *
 * SAFETY
 * It only ever deletes rows it created itself (accounts on .test domains and
 * the four demo companies). It will not touch real sign-ups. Even so, it is a
 * development tool — never point it at a live database with real users.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error(
    "\nMissing keys. This script needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.\n" +
      "See SETUP.md, then try again.\n",
  );
  process.exit(1);
}

// The admin connection ignores all security rules, which is what lets one
// script create data belonging to many different people.
const db = createClient(url, secret, { auth: { persistSession: false } });

/** Every demo login uses this password. */
const DEMO_PASSWORD = "vouch-demo-1234";

/** Marks accounts as demo data so the wipe knows what it may delete. */
const DEMO_EMAIL_SUFFIX = ".test";

const COMPANY_SLUGS = [
  "northgate-coffee",
  "meridian-logistics",
  "verdant-health",
  "bright-path-dental",
];

function stop(label: string, error: { message: string } | null): void {
  if (error) {
    console.error(`\n✗ ${label}\n  ${error.message}\n`);
    process.exit(1);
  }
}

/** Deletes everything a previous run created, so `npm run seed` is repeatable. */
async function wipe(): Promise<void> {
  process.stdout.write("Clearing previous demo data... ");

  // Deleting the login cascades to the profile and everything they own.
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  stop("Could not list users", error);
  const demoUsers = (data?.users ?? []).filter((u) =>
    (u.email ?? "").endsWith(DEMO_EMAIL_SUFFIX),
  );
  for (const user of demoUsers) {
    const { error: delErr } = await db.auth.admin.deleteUser(user.id);
    stop(`Could not delete ${user.email}`, delErr);
  }

  // Companies aren't owned by a person, so they're removed by name.
  const { error: coErr } = await db.from("companies").delete().in("slug", COMPANY_SLUGS);
  stop("Could not delete demo companies", coErr);

  console.log(`done (${demoUsers.length} accounts).`);
}

/** Creates a login plus the matching row in our own users table. */
async function createPerson(
  email: string,
  fullName: string,
  role: "seeker" | "voucher" | "employer",
): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  stop(`Could not create login for ${email}`, error);

  const id = data?.user?.id;
  if (!id) {
    console.error(`\n✗ Supabase did not return a login for ${email}\n`);
    process.exit(1);
  }
  const { error: rowErr } = await db
    .from("users")
    .insert({ id, role, full_name: fullName, email });
  stop(`Could not create user row for ${email}`, rowErr);
  return id;
}

type Row = Record<string, unknown>;

async function insert(table: string, rows: Row[]): Promise<Row[]> {
  const { data, error } = await db.from(table).insert(rows).select();
  stop(`Could not insert into ${table}`, error);
  return data ?? [];
}

async function main(): Promise<void> {
  console.log("\nSeeding Vouch demo data\n" + "=".repeat(40));
  await wipe();

  // ---- Companies ----------------------------------------------------------
  // Northgate and Meridian are fully verified (domain + payment method), so
  // they show the green checkmark. Verdant proved its domain but has no
  // payment method. Bright Path runs on Gmail and has no domain at all — it
  // gets its voucher through the employer-invite path instead.
  process.stdout.write("Creating companies and locations... ");
  const companies = await insert("companies", [
    // Verified Domain: payment method + business registration + proven domain.
    { name: "Northgate Coffee", slug: "northgate-coffee", website: "https://northgatecoffee.test",
      description: "A 12-store coffee chain in the Pacific Northwest.",
      domain_verified_at: new Date().toISOString(), payment_method_on_file: true,
      business_registration_verified_at: new Date().toISOString(),
      business_registration_reference: "EIN 91-2233445" },
    { name: "Meridian Logistics", slug: "meridian-logistics", website: "https://meridianlogistics.test",
      description: "Regional freight and warehousing.",
      domain_verified_at: new Date().toISOString(), payment_method_on_file: true,
      business_registration_verified_at: new Date().toISOString(),
      business_registration_reference: "EIN 91-5566778" },
    // Half-finished: a domain but no payment method, so no badge at all.
    { name: "Verdant Health", slug: "verdant-health", website: "https://verdanthealth.test",
      description: "Community health clinics.",
      domain_verified_at: new Date().toISOString(), payment_method_on_file: false },
    // Verified Business: runs on Gmail, no domain to prove — and still earns
    // a real badge. This is the case the old single checkmark shut out.
    { name: "Bright Path Dental", slug: "bright-path-dental",
      description: "Two-chair family dental practice. Runs on a free email address.",
      payment_method_on_file: true,
      business_registration_verified_at: new Date().toISOString(),
      business_registration_reference: "WA UBI 604-321-987" },
  ]);
  const co = Object.fromEntries(companies.map((c) => [c.slug as string, c.id as string]));

  await insert("company_domains", [
    { company_id: co["northgate-coffee"], domain: "northgatecoffee.test", is_primary: true },
    { company_id: co["meridian-logistics"], domain: "meridianlogistics.test", is_primary: true },
    { company_id: co["verdant-health"], domain: "verdanthealth.test", is_primary: true },
  ]);

  const locations = await insert("locations", [
    { company_id: co["northgate-coffee"], label: "Ballard", city: "Seattle", region: "WA" },
    { company_id: co["northgate-coffee"], label: "Fremont", city: "Seattle", region: "WA" },
    { company_id: co["northgate-coffee"], label: "Capitol Hill", city: "Seattle", region: "WA" },
    { company_id: co["meridian-logistics"], label: "Kent Warehouse", city: "Kent", region: "WA" },
    { company_id: co["meridian-logistics"], label: "Tacoma Depot", city: "Tacoma", region: "WA" },
    { company_id: co["verdant-health"], label: "Rainier Clinic", city: "Seattle", region: "WA" },
    { company_id: co["bright-path-dental"], label: "Greenwood Office", city: "Seattle", region: "WA" },
  ]);
  const loc = Object.fromEntries(locations.map((l) => [l.label as string, l.id as string]));
  console.log("done.");

  // ---- Employers ----------------------------------------------------------
  process.stdout.write("Creating employers... ");
  const erin = await createPerson("erin@northgatecoffee.test", "Erin Delacroix", "employer");
  const marcus = await createPerson("marcus@meridianlogistics.test", "Marcus Bell", "employer");
  const dana = await createPerson("dana@verdanthealth.test", "Dana Whitmore", "employer");
  // Bright Path's owner uses a free email address — that's the whole point of them.
  const rosa = await createPerson("rosa.brightpath@gmail.test", "Rosa Iniguez", "employer");

  await insert("company_members", [
    { company_id: co["northgate-coffee"], user_id: erin, member_role: "owner" },
    { company_id: co["meridian-logistics"], user_id: marcus, member_role: "owner" },
    { company_id: co["verdant-health"], user_id: dana, member_role: "owner" },
    { company_id: co["bright-path-dental"], user_id: rosa, member_role: "owner" },
  ]);
  console.log("done.");

  // ---- Vouchers -----------------------------------------------------------
  process.stdout.write("Creating vouchers... ");
  const now = new Date().toISOString();
  const tomas = await createPerson("tomas@northgatecoffee.test", "Tomas Iversen", "voucher");
  const aisha = await createPerson("aisha@northgatecoffee.test", "Aisha Rahman", "voucher");
  const kenji = await createPerson("kenji@meridianlogistics.test", "Kenji Watanabe", "voucher");
  const lena = await createPerson("lena@verdanthealth.test", "Lena Fischer", "voucher");
  // Marisol works at the Gmail-run dental practice, so there is no company
  // domain to email. She was invited directly by her employer instead.
  const marisol = await createPerson("marisol.private@gmail.test", "Marisol Vega", "voucher");

  await insert("voucher_profiles", [
    { user_id: tomas, company_id: co["northgate-coffee"], location_id: loc["Ballard"],
      job_title: "Shift Supervisor", work_email: "tomas@northgatecoffee.test",
      verification_method: "work_email", status: "verified", verified_at: now,
      employer_permission_confirmed_at: now, identity_verified_at: now, tax_info_collected_at: now },
    { user_id: aisha, company_id: co["northgate-coffee"], location_id: loc["Fremont"],
      job_title: "Barista", work_email: "aisha@northgatecoffee.test",
      verification_method: "work_email", status: "verified", verified_at: now,
      employer_permission_confirmed_at: now },
    { user_id: kenji, company_id: co["meridian-logistics"], location_id: loc["Kent Warehouse"],
      job_title: "Dispatch Lead", work_email: "kenji@meridianlogistics.test",
      verification_method: "work_email", status: "verified", verified_at: now,
      employer_permission_confirmed_at: now, identity_verified_at: now, tax_info_collected_at: now },
    // Not verified yet — she requested a code but never entered it.
    { user_id: lena, company_id: co["verdant-health"], job_title: "Nurse",
      work_email: "lena@verdanthealth.test", verification_method: "work_email", status: "pending" },
    { user_id: marisol, company_id: co["bright-path-dental"], location_id: loc["Greenwood Office"],
      job_title: "Dental Hygienist", verification_method: "employer_invite",
      status: "verified", verified_at: now, employer_permission_confirmed_at: now },
  ]);
  console.log("done.");

  // ---- Seekers ------------------------------------------------------------
  process.stdout.write("Creating seekers... ");
  const jordan = await createPerson("jordan@seeker.test", "Jordan Reyes", "seeker");
  const priya = await createPerson("priya@seeker.test", "Priya Nair", "seeker");
  const sam = await createPerson("sam@seeker.test", "Sam Okafor", "seeker");
  const dee = await createPerson("dee@seeker.test", "Dee Whitfield", "seeker");
  const chris = await createPerson("chris@seeker.test", "Chris Alvarez", "seeker");
  const nina = await createPerson("nina@seeker.test", "Nina Kovac", "seeker");
  const ruth = await createPerson("ruth@seeker.test", "Ruth Adeyemi", "seeker");

  await insert("seeker_profiles", [
    { user_id: jordan, headline: "Barista and shift lead, 4 years", location: "Seattle, WA",
      years_experience: 4, skills: ["customer service", "espresso", "opening/closing", "inventory"],
      desired_titles: ["Barista", "Shift Supervisor"],
      bio: "Four years behind the bar across two independent cafes. Looking for somewhere with room to grow into management." },
    { user_id: priya, headline: "Operations analyst, 6 years", location: "Bellevue, WA",
      years_experience: 6, skills: ["SQL", "forecasting", "Excel", "process design"],
      desired_titles: ["Operations Analyst", "Business Analyst"],
      bio: "Six years in logistics analytics. Left my last role when the team was cut." },
    { user_id: sam, headline: "Warehouse associate, 2 years", location: "Kent, WA",
      years_experience: 2, skills: ["forklift certified", "inventory", "shipping"],
      desired_titles: ["Warehouse Associate"],
      bio: "Forklift certified, reliable early shifts. First job was seasonal and became permanent." },
    { user_id: dee, headline: "Career changer, retail to logistics", location: "Tacoma, WA",
      years_experience: 8, skills: ["scheduling", "team lead", "customer service"],
      desired_titles: ["Dispatcher", "Operations Coordinator"],
      bio: "Eight years managing a retail floor. No warehouse experience yet, but I have run a schedule for 20 people." },
    { user_id: chris, headline: "Recent graduate, health administration", location: "Seattle, WA",
      years_experience: 0, skills: ["scheduling", "medical records", "front desk"],
      desired_titles: ["Medical Receptionist"],
      bio: "Just finished a health administration certificate. No professional experience and no contacts in the field." },
    { user_id: ruth, headline: "Cafe supervisor, 6 years", location: "Seattle, WA",
      years_experience: 6, skills: ["espresso", "opening/closing", "training", "ordering"],
      desired_titles: ["Barista", "Shift Supervisor"],
      bio: "Six years in independent coffee, three of them supervising. Relocated to Ballard in the spring." },
    { user_id: nina, headline: "Dental hygienist, licensed", location: "Seattle, WA",
      years_experience: 5, skills: ["hygiene", "patient education", "x-rays"],
      desired_titles: ["Dental Hygienist"],
      bio: "Licensed hygienist, five years. Moved to Seattle last month and know nobody here." },
  ]);
  console.log("done.");

  // ---- Jobs ---------------------------------------------------------------
  // Notice we never set a fee: the database works out the tier from the pay
  // type (hourly -> $500, salaried -> $2,000) and freezes it onto the job.
  process.stdout.write("Posting jobs... ");
  const jobs = await insert("jobs", [
    { company_id: co["northgate-coffee"], location_id: loc["Ballard"], posted_by: erin,
      title: "Barista", pay_type: "hourly", pay_min_cents: 1900, pay_max_cents: 2300,
      status: "open", posted_at: now,
      description: "Morning shifts at our busiest store. Espresso experience preferred but we will train the right person." },
    { company_id: co["northgate-coffee"], location_id: loc["Fremont"], posted_by: erin,
      title: "Shift Supervisor", pay_type: "hourly", pay_min_cents: 2400, pay_max_cents: 2800,
      status: "open", posted_at: now,
      description: "Run opening shifts, count the till, coach two or three baristas." },
    { company_id: co["northgate-coffee"], location_id: loc["Capitol Hill"], posted_by: erin,
      title: "Store Manager", pay_type: "salaried", pay_min_cents: 6500000, pay_max_cents: 7800000,
      status: "open", posted_at: now,
      description: "Full responsibility for one store: staffing, ordering, and the P&L." },
    { company_id: co["meridian-logistics"], location_id: loc["Kent Warehouse"], posted_by: marcus,
      title: "Warehouse Associate", pay_type: "hourly", pay_min_cents: 2100, pay_max_cents: 2400,
      status: "open", posted_at: now,
      description: "Pick, pack, and load. Forklift certification helpful, not required." },
    { company_id: co["meridian-logistics"], location_id: loc["Tacoma Depot"], posted_by: marcus,
      title: "Dispatcher", pay_type: "hourly", pay_min_cents: 2600, pay_max_cents: 3000,
      status: "open", posted_at: now,
      description: "Coordinate 20 drivers across the south sound. Calm under pressure required." },
    { company_id: co["meridian-logistics"], location_id: loc["Kent Warehouse"], posted_by: marcus,
      title: "Operations Analyst", pay_type: "salaried", pay_min_cents: 8500000, pay_max_cents: 9500000,
      status: "open", posted_at: now,
      description: "Own our routing and volume forecasts. SQL required." },
    { company_id: co["verdant-health"], location_id: loc["Rainier Clinic"], posted_by: dana,
      title: "Medical Receptionist", pay_type: "hourly", pay_min_cents: 2200, pay_max_cents: 2500,
      status: "open", posted_at: now,
      description: "Front desk for a busy community clinic. Bilingual a plus." },
    { company_id: co["bright-path-dental"], location_id: loc["Greenwood Office"], posted_by: rosa,
      title: "Dental Hygienist", pay_type: "hourly", pay_min_cents: 4500, pay_max_cents: 5500,
      status: "open", posted_at: now,
      description: "Four days a week, established patient list, small friendly practice." },
  ]);
  const job = Object.fromEntries(jobs.map((j) => [j.title as string, j.id as string]));
  console.log(`done (${jobs.length} jobs).`);

  // ---- Intro requests, vouches, and candidate progress --------------------
  process.stdout.write("Creating intro requests and vouches... ");

  // Jordan is deliberately at the cap of 5 open requests, so you can see what
  // that state looks like — and watch a 6th get refused.
  await insert("intro_requests", [
    { job_id: job["Barista"], seeker_id: jordan, message: "I have four years on bar and can open." },
    { job_id: job["Shift Supervisor"], seeker_id: jordan, message: "Ready to step up to supervising." },
    { job_id: job["Store Manager"], seeker_id: jordan, message: "A stretch, but I have run a floor." },
    { job_id: job["Warehouse Associate"], seeker_id: jordan, message: "Open to changing industry." },
    { job_id: job["Dispatcher"], seeker_id: jordan, message: "Good on the phone, good under pressure." },
  ]);

  // These four requests each get an answer below.
  const answered = await insert("intro_requests", [
    { job_id: job["Operations Analyst"], seeker_id: priya, message: "Six years of exactly this work." },
    { job_id: job["Warehouse Associate"], seeker_id: sam, message: "Forklift certified, can start Monday." },
    { job_id: job["Dispatcher"], seeker_id: dee, message: "No warehouse background, but I have run a schedule for 20." },
    { job_id: job["Medical Receptionist"], seeker_id: chris, message: "New to the field and trying to get a first shot." },
    { job_id: job["Dental Hygienist"], seeker_id: nina, message: "Licensed, five years, new to Seattle." },
    { job_id: job["Barista"], seeker_id: ruth, message: "Six years on bar, three supervising. I live four blocks away." },
  ]);
  const req = Object.fromEntries(answered.map((r) => [r.seeker_id as string, r.id as string]));

  // Two kinds of vouch, both honest about what they are.
  const vouches = await insert("vouches", [
    { intro_request_id: req[priya], voucher_id: kenji, relationship: "knows_personally",
      body: "Priya and I worked together at my previous employer for two years. She rebuilt our routing forecast and cut empty miles by about a fifth. She is the rare analyst who will go stand in the warehouse and ask drivers what actually happens. I would work with her again without hesitation." },
    { intro_request_id: req[sam], voucher_id: kenji, relationship: "reviewed_profile_only",
      body: "I do not know Sam personally. I read the profile and the resume with our Kent floor in mind. Two years of steady warehouse work, forklift certified, and specifically asking for early shifts, which is the slot we struggle hardest to fill. Nothing here is unusual or overstated. Worth a conversation." },
    { intro_request_id: req[dee], voucher_id: kenji, relationship: "reviewed_profile_only",
      body: "I have not met Dee. On paper this is a career change and the warehouse experience is not there. What is there is eight years running a retail floor and a schedule for twenty people, which is most of what dispatch actually is. I would not promise a fit, but I would spend twenty minutes on a call before passing." },
    { intro_request_id: req[ruth], voucher_id: tomas, relationship: "knows_personally",
      body: "Ruth and I worked the same shifts at my previous cafe for about two years before I moved to Northgate. She trained most of our new starters and was the person I trusted to open on a Saturday. She knows this neighbourhood and she is already a regular at our Ballard store. I would be glad to have her back on a bar with me." },
    { intro_request_id: req[nina], voucher_id: marisol, relationship: "reviewed_profile_only",
      body: "I do not know Nina. I read the profile carefully. Licensed hygienist, five years of experience, recently moved here and openly says she has no contacts in the city. Our practice is small and we have been short a hygienist for two months. The experience lines up cleanly with what we need." },
  ]);

  // Chris's request was declined — an honest no is part of the flow.
  const { error: declineErr } = await db
    .from("intro_requests")
    .update({ status: "declined", claimed_by: lena, responded_at: now })
    .eq("id", req[chris]);
  stop("Could not record the declined request", declineErr);

  // Move the resulting candidates along, the way an employer would.
  const byVouch = Object.fromEntries(vouches.map((v) => [v.seeker_id as string, v.id as string]));
  const progress: Array<[string, string, string]> = [
    [byVouch[priya], "interviewed", marcus],
    [byVouch[sam], "hired", marcus],
    [byVouch[dee], "reviewing", marcus],
    [byVouch[nina], "new", rosa],
    [byVouch[ruth], "interviewed", erin],
  ];
  for (const [vouchId, status, actor] of progress) {
    if (status === "new") continue;
    const { error: upErr } = await db
      .from("applications")
      .update({ status, last_status_changed_by: actor })
      .eq("vouch_id", vouchId);
    stop(`Could not set a candidate to ${status}`, upErr);
  }
  console.log("done.");

  // ---- Hires, payouts, and one that went wrong ----------------------------
  // Enough history that the money and reputation screens have something real
  // to show: one hire that stuck, one that left early, one still inside the
  // 60-day hold.
  process.stdout.write("Recording hires and payouts... ");

  const appFor = async (seekerId: string): Promise<string> => {
    const { data, error } = await db.from("applications").select("id").eq("seeker_id", seekerId).single();
    stop("Could not find the application", error);
    return data!.id as string;
  };
  const daysAgo = (n: number): string =>
    new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

  // Sam started 90 days ago and is still there: the payout has come due.
  await insert("hires", [{
    application_id: await appFor(sam), start_date: daysAgo(90),
    confirmed_by_employer_at: now, confirmed_by_seeker_at: now,
  }]);

  // Priya started 20 days ago and left on day 12 — inside the 30-day window,
  // so the voucher is paid nothing and Meridian earns a credit.
  const priyaHire = await insert("hires", [{
    application_id: await appFor(priya), start_date: daysAgo(20),
    confirmed_by_employer_at: now, confirmed_by_seeker_at: now,
  }]);
  const { error: sepErr } = await db
    .from("hires")
    .update({ separated_at: daysAgo(8) })
    .eq("id", priyaHire[0].id as string);
  stop("Could not record the early departure", sepErr);

  // Ruth started five days ago: still inside the hold.
  await insert("hires", [{
    application_id: await appFor(ruth), start_date: daysAgo(5),
    confirmed_by_employer_at: now, confirmed_by_seeker_at: now,
  }]);

  // Run the scheduled jobs once so the demo data looks like a live system.
  const { error: retErr } = await db.rpc("check_hire_retention");
  stop("Could not run the retention check", retErr);
  const { error: relErr } = await db.rpc("release_due_payouts");
  stop("Could not run the payout release", relErr);
  console.log("done.");

  // ---- Summary ------------------------------------------------------------
  const count = async (table: string): Promise<number> => {
    const { count: n } = await db.from(table).select("*", { count: "exact", head: true });
    return n ?? 0;
  };

  console.log("\n" + "=".repeat(40));
  console.log("Seed complete.\n");
  console.log(`  companies        ${await count("companies")}   (2 verified, 2 not)`);
  console.log(`  locations        ${await count("locations")}`);
  console.log(`  people           ${await count("users")}   (4 employers, 5 vouchers, 7 seekers)`);
  console.log(`  jobs             ${await count("jobs")}`);
  console.log(`  intro requests   ${await count("intro_requests")}`);
  console.log(`  vouches          ${await count("vouches")}`);
  console.log(`  candidates       ${await count("applications")}`);
  console.log(`  hires            ${await count("hires")}   (1 stuck, 1 left early, 1 in the 60-day hold)`);
  console.log(`  payouts          ${await count("payouts")}`);
  console.log(`  employer credits ${await count("employer_credits")}   (from the early departure)`);

  const { data: tiers } = await db.from("companies").select("name, verification_tier").order("name");
  console.log("\n  Company badges:");
  for (const c of tiers ?? []) {
    const label = c.verification_tier === "domain" ? "Verified Domain"
      : c.verification_tier === "business" ? "Verified Business" : "no badge yet";
    console.log(`    ${String(c.name).padEnd(20)} ${label}`);
  }
  console.log("\nEvery demo login uses the password:  " + DEMO_PASSWORD);
  console.log("\n  Employer  erin@northgatecoffee.test      Northgate Coffee (verified)");
  console.log("  Employer  rosa.brightpath@gmail.test     Bright Path Dental (no domain, invite path)");
  console.log("  Voucher   tomas@northgatecoffee.test     verified, Ballard");
  console.log("  Voucher   marisol.private@gmail.test     verified by employer invite");
  console.log("  Voucher   lena@verdanthealth.test        NOT verified — cannot vouch");
  console.log("  Seeker    jordan@seeker.test             at the cap of 5 open requests");
  console.log("  Seeker    nina@seeker.test               vouched by a stranger who read her profile");
  console.log("  Seeker    ruth@seeker.test               vouched by someone who knows her personally");
  console.log("\nAI scores are deliberately empty — those arrive in Step 8.\n");
}

main().catch((err: unknown) => {
  console.error("\nSeeding failed:", err);
  process.exit(1);
});
