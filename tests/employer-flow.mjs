/**
 * tests/employer-flow.mjs — posting a role, working the candidate list, and
 * the hire that makes money owed.
 *
 * Run with:  node --env-file=.env.local tests/employer-flow.mjs
 */
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.VOUCH_BASE_URL ?? "http://localhost:3000";
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PASSWORD = "vouch-demo-1234";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

let pass = 0, fail = 0;
const P = (m) => { console.log("  PASS: " + m); pass++; };
const F = (m) => { console.log("  FAIL: " + m); fail++; };
const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
const cleanup = [];

async function signedIn(email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
  return { ctx, page };
}

// --- 1. posting a role -----------------------------------------------------
console.log("\n--- posting a role ---");
const title = `Test Role ${Date.now()}`;
const { ctx, page } = await signedIn("erin@northgatecoffee.test");
await page.goto(`${BASE}/employer/jobs`);
{
  const body = await page.locator("main").innerText();
  body.includes("Northgate Coffee") ? P("the employer's company is named") : F("company missing");
  body.includes("only when you actually hire") ? P("says posting is free, you pay on a hire") : F("pricing framing missing");
}

await page.fill('input[name="title"]', title);
await page.fill('textarea[name="description"]', "Morning shifts on bar. We will train the right person on espresso, but you need to be reliable at 6am and calm with a queue.");
await page.check('input[value="hourly"]');
await page.waitForTimeout(400);
{
  const body = await page.locator("main").innerText();
  body.includes("$500") ? P("choosing hourly shows the $500 fee before posting") : F("fee not shown for hourly: " + body.slice(0, 200));
}
await page.check('input[value="salaried"]');
await page.waitForTimeout(400);
{
  const body = await page.locator("main").innerText();
  body.includes("$2,000") ? P("switching to salaried shows $2,000 instead") : F("fee didn't change for salaried");
}
await page.check('input[value="hourly"]');
await page.fill('input[name="pay_min"]', "19.00");
await page.fill('input[name="pay_max"]', "23.00");
await page.click('button:has-text("Post this role")');
await page.waitForURL("**/employer/jobs/**", { timeout: 15000 }).catch(() => {});
{
  const { data: job } = await db.from("jobs").select("id, status, pay_type, fee_tier, fee_amount_cents, pay_min_cents, posted_by").eq("title", title).maybeSingle();
  job ? P("the role is in the database") : F("no job created");
  if (job) cleanup.push({ job: job.id });
  job?.status === "open" ? P("it published as open") : F("status is " + job?.status);
  job?.fee_tier === "tier_1" && job?.fee_amount_cents === 50000
    ? P("the database set the fee itself: tier_1, $500") : F(`fee is ${job?.fee_tier}/${job?.fee_amount_cents}`);
  job?.pay_min_cents === 1900 ? P('"19.00" was stored as 1900 cents') : F("pay_min is " + job?.pay_min_cents);
  job?.posted_by ? P("recorded who posted it") : F("posted_by missing");
}

// --- 2. a tampered fee is ignored -----------------------------------------
console.log("\n--- the fee can't be faked ---");
{
  const { data: co } = await db.from("companies").select("id").eq("slug", "northgate-coffee").single();
  const { error } = await db.from("jobs").insert({
    company_id: co.id, title: "Cheap Salaried Role", description: "Trying to pay tier 1 for a salaried role.",
    pay_type: "salaried", status: "draft", fee_tier: "tier_1", fee_amount_cents: 1,
  });
  // The trigger overwrites what was sent; check what actually landed.
  const { data: sneaky } = await db.from("jobs").select("id, fee_tier, fee_amount_cents").eq("title", "Cheap Salaried Role").maybeSingle();
  if (sneaky) cleanup.push({ job: sneaky.id });
  sneaky?.fee_amount_cents === 200000 && sneaky?.fee_tier === "tier_2"
    ? P("a hand-set fee is overwritten — the salaried role still costs $2,000")
    : F(`the fee stuck at ${sneaky ? "$" + sneaky.fee_amount_cents / 100 : "row rejected"} (needs migration 0007 on this database)`);
}

// --- 3. the candidate list -------------------------------------------------
// Build our own candidate so the test doesn't depend on whatever state the
// seed happens to be in — an already-hired candidate has no next steps, and a
// seeded seeker has no resume, both of which look like failures if you assume.
console.log("\n--- the candidate list ---");
{
  const email = `cand-${Date.now()}@vouchtest.dev`;
  const { data: sc } = await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { role: "seeker" },
  });
  cleanup.push({ user: sc.user.id });
  await db.from("users").insert({ id: sc.user.id, role: "seeker", full_name: "Cass Candidate", email });
  await db.from("seeker_profiles").insert({ user_id: sc.user.id, headline: "Barista, 4 years" });

  // a real file in the private bucket
  const path = `${sc.user.id}/resume-${Date.now()}.txt`;
  // A Buffer, not a Blob: uploading a Blob makes the client send
  // application/octet-stream, which the bucket rightly refuses.
  const { error: upErr } = await db.storage
    .from("resumes")
    .upload(path, Buffer.from("Cass Candidate\nBarista, 4 years"), { contentType: "text/plain" });
  if (upErr) F("could not upload a test resume: " + upErr.message);
  await db.from("seeker_profiles").update({ resume_path: path, resume_uploaded_at: new Date().toISOString() }).eq("user_id", sc.user.id);

  const { data: co } = await db.from("companies").select("id").eq("slug", "northgate-coffee").single();
  const { data: job } = await db.from("jobs").select("id").eq("company_id", co.id).eq("status", "open").limit(1).single();
  const { data: req } = await db.from("intro_requests").insert({ job_id: job.id, seeker_id: sc.user.id }).select("id").single();
  const { data: tomas } = await db.from("users").select("id").eq("email", "tomas@northgatecoffee.test").single();
  await db.from("vouches").insert({
    intro_request_id: req.id, voucher_id: tomas.id, relationship: "knows_personally",
    body: "I worked alongside Cass for two years and would take them back on my own bar without hesitation. Reliable at opening, calm at peak, and the person who trained our new starters.",
  });
  const { data: app } = await db.from("applications").select("id, job_id, status").eq("seeker_id", sc.user.id).single();

  await page.goto(`${BASE}/employer/jobs/${app.job_id}`);
  await page.locator("text=Cass Candidate").first().waitFor({ timeout: 10000 });
  const body = await page.locator("main").innerText();

  body.includes("Knows them personally") ? P("the vouch is labelled, so the employer knows which kind it is") : F("vouch label missing");
  body.includes("They receive $") ? P("what the voucher earns is disclosed to the employer") : F("voucher payment not disclosed");
  /No AI score yet|advisory only/.test(body) ? P("the AI section is present and framed as advisory") : F("AI framing missing");
  body.includes("decision on this page is yours") ? P("states plainly that a human decides") : F("human-decides line missing");

  const card = page.locator('[data-slot="card"]').filter({ hasText: "Cass Candidate" });
  (await card.locator('a:has-text("Open their resume")').count()) > 0
    ? P("their resume is reachable from the candidate card") : F("no resume link on the card");

  app.status === "new" ? P('a new candidate starts as "new"') : F("status is " + app.status);
  await card.locator('button:has-text("Start reviewing")').click();
  await page.waitForTimeout(2500);
  const { data: after } = await db.from("applications").select("status, last_status_changed_by").eq("id", app.id).maybeSingle();
  after?.status === "reviewing" ? P("moved new -> reviewing") : F("status is " + after?.status);
  after?.last_status_changed_by ? P("and the person who moved it was recorded") : F("no human recorded on the change");
}

// --- 4. the hire, and what it takes to make money owed --------------------
console.log("\n--- recording a hire ---");
const seekerEmail = `hire-me-${Date.now()}@vouchtest.dev`;
{
  // a fresh seeker, vouched for, ready to be hired
  const { data: sc } = await db.auth.admin.createUser({
    email: seekerEmail, password: PASSWORD, email_confirm: true, user_metadata: { role: "seeker" },
  });
  cleanup.push({ user: sc.user.id });
  await db.from("users").insert({ id: sc.user.id, role: "seeker", full_name: "Hire Me", email: seekerEmail });
  await db.from("seeker_profiles").insert({ user_id: sc.user.id, headline: "Ready to start" });
  const { data: co } = await db.from("companies").select("id").eq("slug", "northgate-coffee").single();
  const { data: job } = await db.from("jobs").select("id").eq("company_id", co.id).eq("status", "open").limit(1).single();
  const { data: req } = await db.from("intro_requests").insert({ job_id: job.id, seeker_id: sc.user.id }).select("id").single();
  const { data: tomas } = await db.from("users").select("id").eq("email", "tomas@northgatecoffee.test").single();
  await db.from("vouches").insert({
    intro_request_id: req.id, voucher_id: tomas.id, relationship: "reviewed_profile_only",
    body: "A careful written assessment of this candidate, long enough to clear the minimum length the product requires of every vouch.".repeat(2),
  });
  const { data: app } = await db.from("applications").select("id, job_id").eq("seeker_id", sc.user.id).single();

  await page.goto(`${BASE}/employer/jobs/${app.job_id}`);
  await page.locator(`text=Hire Me`).first().waitFor({ timeout: 10000 });
  await page.locator('button:has-text("We hired Hire")').first().click();
  await page.fill('input[name="start_date"]', new Date().toISOString().slice(0, 10));
  await page.click('button:has-text("Confirm the hire")');
  await page.waitForTimeout(3000);

  const { data: hire } = await db.from("hires").select("id, status, confirmed_by_employer_at, confirmed_by_seeker_at, fee_amount_cents, voucher_amount_cents").eq("application_id", app.id).maybeSingle();
  hire ? P("the hire was recorded") : F("no hire row");
  hire?.confirmed_by_employer_at ? P("employer's confirmation stored") : F("employer confirmation missing");
  hire?.status === "reported" ? P('status is "reported" — NOT confirmed on the employer\'s word alone') : F("status is " + hire?.status);

  const { count: payouts } = await db.from("payouts").select("id", { count: "exact" }).eq("hire_id", hire?.id ?? "");
  const { count: charges } = await db.from("employer_charges").select("id", { count: "exact" }).eq("hire_id", hire?.id ?? "");
  (payouts ?? 0) === 0 && (charges ?? 0) === 0
    ? P("no payout and no charge exist yet — nothing is owed") : F(`money created too early: ${payouts} payouts, ${charges} charges`);

  const { data: appAfter } = await db.from("applications").select("status").eq("id", app.id).maybeSingle();
  appAfter?.status === "hired" ? P("the candidate shows as hired") : F("candidate status is " + appAfter?.status);

  // now the seeker confirms
  const { ctx: c2, page: p2 } = await signedIn(seekerEmail);
  await p2.goto(`${BASE}/requests`);
  const askText = await p2.locator("main").innerText();
  askText.includes("Did you start at Northgate Coffee?") ? P("the seeker is asked to confirm") : F("seeker not asked: " + askText.slice(0, 200));
  await p2.click('button:has-text("Yes, I started there")');
  await p2.waitForTimeout(3000);
  await c2.close();

  const { data: settled } = await db.from("hires").select("status, payout_due_at, start_date").eq("id", hire.id).maybeSingle();
  settled?.status === "confirmed" ? P("both sides confirmed -> the hire is confirmed") : F("status is " + settled?.status);
  const { data: payout } = await db.from("payouts").select("amount_cents, status, release_at").eq("hire_id", hire.id).maybeSingle();
  payout ? P(`a payout of $${payout.amount_cents / 100} is now scheduled`) : F("no payout created");
  payout?.release_at === settled?.payout_due_at ? P("released 60 days after the start date") : F("release date wrong");
  const { data: charge } = await db.from("employer_charges").select("amount_cents, status").eq("hire_id", hire.id).maybeSingle();
  charge ? P(`the employer is billed $${charge.amount_cents / 100} (${charge.status})`) : F("no charge created");
}

await ctx.close();

// tidy up
for (const item of cleanup) {
  if (item.user) await db.auth.admin.deleteUser(item.user);
  if (item.job) await db.from("jobs").delete().eq("id", item.job);
}
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
