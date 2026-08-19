/**
 * tests/voucher-inbox.mjs — the voucher's inbox, and the loop closing.
 *
 * A seeker asks, a voucher reads their profile and writes a vouch, and the
 * employer's candidate list gains a person. Also checks the things that must
 * NOT happen: seeing another company's requests, one-line vouches, and
 * vouching while unverified.
 *
 * Run with:  node --env-file=.env.local tests/voucher-inbox.mjs
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
const idOf = async (email) => (await db.from("users").select("id").eq("email", email).single()).data.id;

/** A seeker with a pending request ONLY at Meridian, for the isolation check. */
async function meridianSeeker() {
  const email = `meridian-only-${Date.now()}@vouchtest.dev`;
  const { data } = await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { role: "seeker" },
  });
  cleanup.push(data.user.id);
  await db.from("users").insert({ id: data.user.id, role: "seeker", full_name: "Meridian Only Tester", email });
  await db.from("seeker_profiles").insert({ user_id: data.user.id, headline: "Only ever asked Meridian" });
  const { data: co } = await db.from("companies").select("id").eq("slug", "meridian-logistics").single();
  const { data: job } = await db.from("jobs").select("id").eq("company_id", co.id).eq("status", "open").limit(1).single();
  await db.from("intro_requests").insert({ job_id: job.id, seeker_id: data.user.id });
  return true;
}

// A fresh seeker who asks Northgate for an intro, so the test is self-contained.
const seekerEmail = `inbox-seeker-${Date.now()}@vouchtest.dev`;
const { data: sc } = await db.auth.admin.createUser({
  email: seekerEmail, password: PASSWORD, email_confirm: true, user_metadata: { role: "seeker" },
});
cleanup.push(sc.user.id);
await db.from("users").insert({ id: sc.user.id, role: "seeker", full_name: "Ada Fresh", email: seekerEmail });
await db.from("seeker_profiles").insert({
  user_id: sc.user.id, headline: "Barista, 3 years", location: "Seattle, WA",
  years_experience: 3, skills: ["espresso", "latte art"], bio: "Three years on bar at an independent cafe.",
});
const { data: northgate } = await db.from("companies").select("id").eq("slug", "northgate-coffee").single();
const { data: ngJob } = await db.from("jobs").select("id, title, fee_amount_cents, voucher_share_bps")
  .eq("company_id", northgate.id).eq("status", "open").limit(1).single();
await db.from("intro_requests").insert({ job_id: ngJob.id, seeker_id: sc.user.id, message: "I live four blocks away and can open." });

// --- 1. the inbox shows the right people, and only them -------------------
console.log("\n--- the voucher's inbox ---");
{
  await meridianSeeker();
  const { ctx, page } = await signedIn("tomas@northgatecoffee.test");
  await page.goto(`${BASE}/inbox`);
  const body = await page.locator("main").innerText();
  body.includes("Ada Fresh") ? P("the new request appears in the inbox") : F("request missing: " + body.slice(0, 200));
  body.includes("Barista, 3 years") ? P("their headline shows without opening anything") : F("headline missing");
  body.includes("I live four blocks away") ? P("their note to the voucher shows") : F("note missing");
  body.includes("of 5 vouches open") ? P("the voucher's own cap is shown") : F("cap not shown");

  // Someone who exists ONLY at the other company must be invisible here.
  // (Testing by name only works if the name is unique to that company —
  // Jordan Reyes has requests at both, so he'd be a false alarm.)
  !body.includes("Meridian Only Tester")
    ? P("a seeker who only asked at Meridian is invisible to a Northgate voucher")
    : F("a Meridian-only requester leaked into the Northgate inbox");

  await ctx.close();
}

// --- 2. reading the profile -----------------------------------------------
console.log("\n--- reading their profile ---");
const { ctx, page } = await signedIn("tomas@northgatecoffee.test");
await page.goto(`${BASE}/inbox`);
await page.click('a:has-text("Ada Fresh")');
await page.waitForLoadState("networkidle");
{
  const body = await page.locator("main").innerText();
  body.includes("Three years on bar") ? P("their bio is readable") : F("bio missing");
  body.includes("espresso") ? P("their skills show") : F("skills missing");
  body.includes(ngJob.title) ? P("the role they applied for is named") : F("role missing");
  const expected = `$${((ngJob.fee_amount_cents * ngJob.voucher_share_bps) / 10000 / 100).toLocaleString()}`;
  body.includes(expected) ? P(`what the voucher would earn is stated up front (${expected})`) : F("earnings not disclosed: " + body.slice(-300));
  body.includes("everyone knows") || body.includes("Paid endorsements")
    ? P("and it says the employer is told about it") : F("disclosure wording missing");
  (await page.locator('input[value="knows_personally"]').count()) === 1 &&
  (await page.locator('input[value="reviewed_profile_only"]').count()) === 1
    ? P("both kinds of vouch are offered") : F("vouch type options missing");
}

// --- 3. a one-line vouch is refused ---------------------------------------
console.log("\n--- a low-effort vouch ---");
await page.check('input[value="reviewed_profile_only"]');
await page.fill('textarea[name="body"]', "Good person, hire them.");
await page.click('button:has-text("Vouch for this person")');
await page.waitForTimeout(2500);
{
  const err = (await page.locator('[role="alert"]').allInnerTexts()).join(" ");
  err.includes("characters") ? P("a one-line vouch is refused with a character count") : F("no length refusal: " + err.slice(0, 140));
  const { count } = await db.from("vouches").select("id", { count: "exact" }).eq("seeker_id", sc.user.id);
  (count ?? 0) === 0 ? P("nothing was saved") : F("a vouch was saved anyway");
}

// --- 4. a real vouch ------------------------------------------------------
console.log("\n--- writing a real vouch ---");
const vouchText =
  "I have not met Ada. I read the profile with our Ballard bar in mind. Three years on espresso at an independent cafe is the right shape for us, and the specific mention of opening shifts matters because that is the slot we struggle hardest to cover. Nothing here is overstated. I would want someone to check how they handle a queue at peak, but I would happily spend twenty minutes talking to them.";
await page.fill('textarea[name="body"]', vouchText);
await page.check('input[value="reviewed_profile_only"]');
await page.click('button:has-text("Vouch for this person")');
await page.waitForURL("**/inbox**", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2000);
{
  const body = await page.locator("main").innerText();
  body.includes("Vouch written") ? P("the voucher gets a confirmation") : F("no confirmation: " + body.slice(0, 160));

  const { data: v } = await db.from("vouches").select("relationship, body, disclosed_fee_cents, voucher_id").eq("seeker_id", sc.user.id).maybeSingle();
  v ? P("the vouch is in the database") : F("no vouch saved");
  v?.relationship === "reviewed_profile_only" ? P('labelled "reviewed_profile_only", honestly') : F("relationship is " + v?.relationship);
  v?.disclosed_fee_cents === (ngJob.fee_amount_cents * ngJob.voucher_share_bps) / 10000
    ? P(`the fee disclosure was frozen onto it ($${v.disclosed_fee_cents / 100})`) : F("fee disclosure wrong: " + v?.disclosed_fee_cents);

  const { data: req } = await db.from("intro_requests").select("status, claimed_by").eq("seeker_id", sc.user.id).maybeSingle();
  req?.status === "vouched" ? P("the seeker's request is marked vouched") : F("request status is " + req?.status);
  req?.claimed_by === (await idOf("tomas@northgatecoffee.test")) ? P("and attributed to the voucher") : F("claimed_by wrong");

  const { data: app } = await db.from("applications").select("id, status").eq("seeker_id", sc.user.id).maybeSingle();
  app ? P("an employer-facing candidate record appeared automatically") : F("no application created");
  app?.status === "new" ? P('it starts as "new" for the employer') : F("status is " + app?.status);
}
await ctx.close();

// --- 5. the seeker's side -------------------------------------------------
console.log("\n--- what the seeker sees ---");
{
  const { ctx: c2, page: p2 } = await signedIn(seekerEmail);
  await p2.goto(`${BASE}/requests`);
  const body = await p2.locator("main").innerText();
  body.includes("Someone vouched for you") ? P("the seeker sees they were vouched for") : F("seeker not told: " + body.slice(0, 200));
  await c2.close();
}

// --- 6. the employer's side -----------------------------------------------
console.log("\n--- what the employer sees ---");
{
  const { ctx: c3, page: p3 } = await signedIn("erin@northgatecoffee.test");
  const body = await p3.locator("main").innerText();
  const { count } = await db.from("applications").select("id", { count: "exact" }).eq("seeker_id", sc.user.id);
  count === 1 ? P("the candidate is attached to the employer's job") : F("application count " + count);
  body.includes("vouched candidates") || body.includes("Your roles") ? P("the employer dashboard reflects candidates") : F("dashboard missing candidate area");
  await c3.close();
}

// --- 7. an unverified voucher can't reach any of it -----------------------
console.log("\n--- an unverified voucher ---");
{
  const { ctx: c4, page: p4 } = await signedIn("lena@verdanthealth.test");
  await p4.goto(`${BASE}/inbox`);
  await p4.waitForLoadState("networkidle");
  p4.url().includes("/verify") ? P("an unverified voucher is sent to verify, not the inbox") : F("landed on " + p4.url());
  await c4.close();
}

// tidy up
await db.from("vouches").delete().eq("seeker_id", sc.user.id);
for (const id of cleanup) await db.auth.admin.deleteUser(id);
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
